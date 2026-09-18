import axios from "axios";
import {tool} from 'langchain';
import * as z from 'zod';
import { fi } from "zod/v4/locales";


//list-files tool
export const listFiles = tool(async ({}, config) => {

    console.log('===========================')
    console.log('using list files tool')
    console.log('===========================')

    try {

        const projectId = config.context.projectId

        const response = await axios.get(
            `http://sandbox-service-${projectId}:3000/list-files`
        )

        console.log('===========================')
        console.log('response from the list files tool:', response.data)
        console.log('===========================')

        return response.data.files

    } catch (error) {

        console.log('===========================')
        console.log('list files error:')
        console.log(error.message)
        console.log(error.response?.data)
        console.log('===========================')

        throw error
    }
},
{
    name: 'list_files',
    description: 'List all the files in the project directory. This is useful for understanding what files are available to work with.',
    schema: z.object({})
})

//read-files tool
export const readFiles = tool(async ({ files },config) => {
    console.log('===========================')
    console.log('using read files tool')
    console.log('files:', files)
    console.log('===========================')

    try {
            const projectId = config.context.projectId
        const response = await axios.get(
            `http://sandbox-service-${projectId}:3000/read-files?files=` + files.join(','))

        console.log('===========================')
        console.log('response from read files tool:', response.data)
        console.log('===========================')

        return JSON.stringify(response.data)
    } catch (error) {
        console.log('===========================')
        console.log('read files error:')
        console.log(error.message)
        console.log(error.response?.data)
        console.log('===========================')

        throw error
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
   const projectId = config.context.projectId
    console.log('===========================')
    console.log('using update files tool')
    console.log('FILES:', files)
    console.log('===========================')

    const response=await axios.patch(
        `http://sandbox-service-${projectId}:3000/update-files`,
        {
            updates: files
        }
    )

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

    console.log('===========================')
    console.log('USING INSTALL DEPENDENCIES TOOL')
    console.log('PACKAGES:', packages)
    console.log('===========================')

    try {
            const projectId = config.context.projectId

        const response = await axios.post(
            `http://sandbox-service-${projectId}:3000/install-dependencies`,
            {
                packages: packages
            }
        )

        console.log('===========================')
        console.log('DEPENDENCIES INSTALL RESPONSE:')
        console.log(response.data)
        console.log('===========================')

        return JSON.stringify(response.data)

    } catch (error) {

        console.log('===========================')
        console.log('INSTALL DEPENDENCIES ERROR:')
        console.log(error.message)
        console.log(error.response?.data)
        console.log('===========================')

        throw error
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