import axios from "axios";
import {tool} from 'langchain';
import * as z from 'zod';
import { fi } from "zod/v4/locales";

const sandboxUrl = (projectId, path) => `http://sandbox-service-${projectId}:3000${path}`
const sandboxClient = axios.create({ timeout: 30000 })


//list-files tool
export const listFiles = tool(async ({}, config) => {

    // console.log('===========================')
    // console.log('using list files tool')
    // console.log('===========================')

    const writer=config.writer

    
    try {
        
        const projectId = config.context.projectId
        
        writer('Listing files in project directory...\n')

        const response = await sandboxClient.get(sandboxUrl(projectId, '/list-files'))
        writer('Files listed successfully. '+'Files: '+response.data.files.join(",")+'\n')

        // console.log('===========================')
        // console.log('response from the list files tool:', response.data)
        // console.log('===========================')

        return response.data.files

    } catch (error) {

        // console.log('===========================')
        // console.log('list files error:')
        console.log(error.message)
        // console.log(error.response?.data)
        // console.log('===========================')

        throw new Error(`Unable to list sandbox files: ${error.response?.data?.message || error.message}`)
    }
},
{
    name: 'list_files',
    description: 'List all the files in the project directory. This is useful for understanding what files are available to work with.',
    schema: z.object({})
})

//read-files tool
export const readFiles = tool(async ({ files },config) => {

    const writer=config.writer

    writer('Reading files... '+files.join(",")+'\n')

    // console.log('===========================')
    // console.log('using read files tool')
    // console.log('files:', files)
    // console.log('===========================')

    try {
            const projectId = config.context.projectId
        const response = await sandboxClient.get(sandboxUrl(projectId, '/read-files?files=') + files.join(','))

            writer('Files read successfully.\n')

        // console.log('===========================')
        // console.log('response from read files tool:', response.data)
        // console.log('===========================')

        return JSON.stringify(response.data)
    } catch (error) {
        // console.log('===========================')
        // console.log('read files error:')
        console.log(error.message)
        // console.log(error.response?.data)
        // console.log('===========================')

        throw new Error(`Unable to read sandbox files: ${error.response?.data?.message || error.message}`)
    }
}, {
    name: 'read_files',
    description: 'Read the contents of specified files. This is useful for understanding the content of files that are relevant to the task at hand.',
    schema: z.object({
        files: z.array(z.string()).describe('The list of files to read')
    })
})

//update-files/create-files tool
export const updateFiles=tool(async({files},config)=>
{

    const writer=config.writer

    writer('Updating files... '+files.map(elem=>elem.file).join(",")+'\n')

   const projectId = config.context.projectId
    // console.log('===========================')
    // console.log('using update files tool')
    // console.log('FILES:', files)
    // console.log('===========================')

    const response=await sandboxClient.patch(
        sandboxUrl(projectId, '/update-files'),
        {
            updates: files
        }
    )
    // The invoke route uses this authoritative signal to decide whether the
    // request genuinely changed the workspace. A model's final text is not a
    // reliable indication that the tool was called.
    if (config.context?.mutationState) config.context.mutationState.updated = true
    writer('Files updated successfully.\n')

    return JSON.stringify({
    status: 'success',
    results: response.data.results
})
},
{
    name:'update_files',
    description:'Update the contents of specified files. This is useful for making changes to files based on the requirements of the task at the hand. This tool can also be used to create new files by providing a new file name in the file field and the content to be added in the content field.',
    schema:z.object({
        files:z.array(z.object({
            file:z.string().describe('The absolute path of the file to update'),
            content:z.string().describe('The new content for the file')
        })).describe('The list of the files to update and their contents')
    })
})

// install-dependencies tool
export const installDependencies = tool(async ({ packages },config) => {

    const writer=config.writer

    writer('Installing dependencies in directory...\n')

    // console.log('===========================')
    // console.log('USING INSTALL DEPENDENCIES TOOL')
    // console.log('PACKAGES:', packages)
    // console.log('===========================')

    try {
            const projectId = config.context.projectId

        const response = await sandboxClient.post(
            sandboxUrl(projectId, '/install-dependencies'),
            {
                packages: packages
            }
        )
        writer('Dependencies installed successfully.\n')

        // console.log('===========================')
        // console.log('DEPENDENCIES INSTALL RESPONSE:')
        // console.log(response.data)
        // console.log('===========================')

        return JSON.stringify(response.data)

    } catch (error) {

        // console.log('===========================')
        // console.log('INSTALL DEPENDENCIES ERROR:')
        // console.log(error.message)
        console.log(error.response?.data)
        // console.log('===========================')

        throw new Error(`Unable to install dependencies: ${error.response?.data?.message || error.message}`)
    }

}, {
    name: 'install_dependencies',

    description:
        'Install npm dependencies required by the project. Use this tool when the project needs npm packages that are not currently installed. Pass the package names that need to be installed.',

    schema: z.object({
        packages: z.array(
            z.string().describe('The npm package name to install')
        ).describe('List of npm packages that need to be installed')
    })
})
