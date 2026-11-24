import express, { urlencoded } from 'express'
import morgan from 'morgan'
import fs from 'fs'
import path from 'path';
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

const app=express();

const WORKING_DIR='/workspace'
const TAILWIND_DIRECTIVES='@tailwind base;\n@tailwind components;\n@tailwind utilities;'

// Every generated project is Tailwind-ready.  This is deliberately enforced
// by the sandbox rather than relying on the coding model to remember a setup
// step before it writes CSS.
const ensureTailwind = async (updates = []) => {
    const cssUpdate = updates.find(({ file }) => file === 'src/index.css')

    if (cssUpdate) {
        cssUpdate.content = cssUpdate.content
            .replace(/@import\s+['"]tailwindcss['"];?\s*/g, '')
        if (!cssUpdate.content.includes('@tailwind utilities')) {
            cssUpdate.content = `${TAILWIND_DIRECTIVES}\n\n${cssUpdate.content}`
        }
    }

    try {
        const tailwindPackage = JSON.parse(await fs.promises.readFile(path.join(WORKING_DIR, 'node_modules', 'tailwindcss', 'package.json'), 'utf8'))
        if (!tailwindPackage.version.startsWith('3.')) throw new Error('Tailwind v3 is required')
    } catch {
        await execFileAsync('npm', ['install', '--save-dev', 'tailwindcss@3.4.17', 'postcss@8.5.3', 'autoprefixer@10.4.21'], { cwd: WORKING_DIR })
    }

    const postcssConfig = path.join(WORKING_DIR, 'postcss.config.js')
    const tailwindConfig = path.join(WORKING_DIR, 'tailwind.config.js')
    try {
        await fs.promises.access(postcssConfig)
    } catch {
        await fs.promises.writeFile(postcssConfig, "export default { plugins: { tailwindcss: {}, autoprefixer: {} } }\n")
    }
    try {
        await fs.promises.access(tailwindConfig)
    } catch {
        await fs.promises.writeFile(tailwindConfig, "export default { content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'], theme: { extend: {} }, plugins: [] }\n")
    }
}

const validateProjectBuild = async () => {
    await execFileAsync('npm', ['run', 'build'], {
        cwd: WORKING_DIR,
        timeout: 120000,
        maxBuffer: 1024 * 1024
    })
}

// Vite's development optimizer can expose a missing named package export only
// in the browser. Catch those imports before accepting an AI file update.
const validateNamedPackageImports = async () => {
    const sourceDir = path.join(WORKING_DIR, 'src')
    const files = await fs.promises.readdir(sourceDir, { recursive: true })
    const sourceFiles = files.filter(file => /\.[cm]?[jt]sx?$/.test(file))
    const importPattern = /import\s*{([^}]+)}\s*from\s*['"]([^.'"][^'"]*)['"]/g

    for (const relativeFile of sourceFiles) {
        const content = await fs.promises.readFile(path.join(sourceDir, relativeFile), 'utf8')
        for (const match of content.matchAll(importPattern)) {
            const [, imported, packageName] = match
            let exportedNames
            try {
                const { stdout } = await execFileAsync('node', [
                    '-e',
                    "const { createRequire } = require('node:module'); const requireFromWorkspace = createRequire(process.cwd() + '/package.json'); console.log(JSON.stringify(Object.keys(requireFromWorkspace(process.argv[1]))))",
                    packageName
                ], { cwd: WORKING_DIR, timeout: 15000 })
                exportedNames = new Set(JSON.parse(stdout))
            } catch (error) {
                throw new Error(`Cannot load package "${packageName}" imported by src/${relativeFile}: ${error.message}`)
            }
            const missing = imported
                .split(',')
                .map(item => item.trim().split(/\s+as\s+/)[0].trim())
                .filter(Boolean)
                .filter(name => !exportedNames.has(name))
            if (missing.length) {
                throw new Error(`Invalid export from "${packageName}" in src/${relativeFile}: ${missing.join(', ')}`)
            }
        }
    }
}

app.use(express.json())
app.use(express.urlencoded({extended:true}))
app.use(morgan('dev'))

app.get('/',(req,res)=>
{
    res.status(200).json({
        message:'Hello from sandbox agent',
        status:'success'
    })
})
app.get('/healthz', (req, res) => {
    res.status(200).json({ status: 'ok' })
})

//list-files api (doesn't include node_modules, .git, dist, .env)
app.get('/list-files',(async(req,res)=>
{
    const listFiles=(async(dir,baseDir)=>
    {
        const entries=await fs.promises.readdir(dir,{withFileTypes:true})
        const files=[];

        for(const entry of entries)
        {
            const fullPath=path.join(dir,entry.name)
            const relativePath=path.relative(baseDir,fullPath)

            //exclude certain directories
            if(entry.isDirectory()&&['node_modules','.git','dist','.env'].includes(entry.name)){
                continue;
            }
            if(entry.isDirectory()){
                files.push(...await listFiles(fullPath,baseDir))
            }
            else{
                files.push(relativePath)
            }
        }

        return files;
    })

    try{
        const files=await listFiles(WORKING_DIR, WORKING_DIR)
        res.status(200).json({
            message:'Files listed successfully',
            files
        })
    }
    catch(err){
        res.status(500).json({
            message:`Error listing files: ${err.message}`,
            status:'error'
        })
    }

}))

//read-files api
app.get('/read-files',(async(req,res)=>
{
    const files=req.query.files

    if(!files)
    {
        return res.status(400).json({
            message:'No files specifies in query parameter',
            status:'error'
        })
    }

    const fileList=files.split(',');

    const results=await Promise.all(fileList.map(async(elem,indx)=>
    {
        const filePath=path.join(WORKING_DIR,elem)
        
        try{
            const content=await fs.promises.readFile(filePath,'utf-8')
            return{
                [filePath.replace(WORKING_DIR,'')]:content
            }
        }
        catch(err){
            return{
                [filePath.replace(WORKING_DIR,'')]:`Error reading file: ${err.message}`
            }
        }
    }))

    return res.status(200).json({
        message:'File contents',
        results
    })
}))

//update-files api
app.patch('/update-files',(async(req,res)=>
{
    const updates=req.body.updates;

    if(!updates || !Array.isArray(updates))
    {
        return res.status(400).json({
            message:'Invalid request body. Expected a JSON body with "updates" property containing an array of file updates',
            status:'error'
        })
    }

    try {
        await ensureTailwind(updates)
    } catch (err) {
        return res.status(500).json({
            message: `Unable to prepare Tailwind CSS: ${err.message}`,
            status: 'error'
        })
    }

    if (updates.some(({ content }) => /<\/?(?:bos|eos)>|<\|.*?\|>/.test(content))) {
        return res.status(422).json({
            message: 'Rejected invalid AI control tokens in source code',
            status: 'error'
        })
    }

    const originals = await Promise.all(updates.map(async ({ file }) => {
        const filePath = path.join(WORKING_DIR, file)
        try {
            return { filePath, content: await fs.promises.readFile(filePath, 'utf-8') }
        } catch (err) {
            if (err.code === 'ENOENT') return { filePath, content: null }
            throw err
        }
    }))

    try {
        const results=await Promise.all(updates.map(async({file, content}) => {
            const filePath=path.join(WORKING_DIR,file)
            await fs.promises.mkdir(path.dirname(filePath), { recursive: true })
            await fs.promises.writeFile(filePath,content,'utf-8')
            return{
                [filePath]:'File updated successfully'
            }
        }))

        await validateNamedPackageImports()
        await validateProjectBuild()

        return res.status(200).json({ message:'File update results', results })
    } catch (err) {
        await Promise.all(originals.map(async ({ filePath, content }) => {
            if (content === null) return fs.promises.rm(filePath, { force: true })
            return fs.promises.writeFile(filePath, content, 'utf-8')
        }))

        return res.status(422).json({
            message: `Update rolled back because the project does not build: ${err.stderr || err.message}`,
            status: 'error'
        })
    }

}))

//create-files api
app.post('/create-files',(async(req,res)=>
{
    const files=req.body.files;

    if(!files || !Array.isArray(files))
    {
        return res.status(400).json({
            message:'Invalid request body. Expected a JSON body with "files" property containing an array of file updates',
            status:'error'
        })
    }

    const results=await Promise.all(files.map(async(elem,indx)=>
    {
        const{file,content}=elem
        const filePath=path.join(WORKING_DIR,file)
        try{
            await fs.promises.mkdir(path.dirname(filePath),{recursive:true})
            await fs.promises.writeFile(filePath,content,'utf-8')
            return{
                [filePath]:'File created successfully'
            }
        }
        catch(err){
            return{
                [filePath]:`Error creating file: ${err.message}`
            }
        }
    }))

    res.status(200).json({
        message:'File creation results',
        results
    })

}))

//install-dependencies api
app.post('/install-dependencies', async (req, res) => {
    try {
        const { packages = [] } = req.body

        if (!Array.isArray(packages)) {
            return res.status(400).json({
                message: 'Invalid request. "packages" must be an array',
                status: 'error'
            })
        }

        const args = packages.length > 0
            ? ['install', ...packages]
            : ['install']

        const { stdout, stderr } = await execFileAsync(
            'npm',
            args,
            {
                cwd: WORKING_DIR
            }
        )

        return res.status(200).json({
            message: 'Dependencies installed successfully',
            status: 'success',
            stdout,
            stderr
        })

    } catch (err) {
        return res.status(500).json({
            message: 'Failed to install dependencies',
            status: 'error',
            error: err.message,
            stdout: err.stdout,
            stderr: err.stderr
        })
    }
})

export default app;
