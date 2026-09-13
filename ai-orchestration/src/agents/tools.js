import axios from "axios";
import {tool} from 'langchain';
import * as z from 'zod';
import { fi } from "zod/v4/locales";


//list-files tool
export const listFiles=tool(async({})=>
{
    console.log('===========================')
    console.log('using list files tool')
    console.log('===========================')

    //tool initialization
     try {
        const response = await axios.get(
  'http://127.0.0.1/list-files',
  {
    headers: {
      Host: '01a09b0d-b734-71b6-b1ed-8e48f584fc7e.agent.localhost'
    }
  }
)

        console.log('===========================')
        console.log('response from the list files tool', response.data)
        console.log('===========================')

        return response.data.files
    } catch (error) {
        console.log('list files error:')
        console.log(error.message)
        console.log(error.response?.data)
        throw error
    }
},
{   //tool details with desc. and schema
    name:'list_files',
    description:'List all the files in the project directory. This is useful for understanding what files are available to work with.',
    schema:z.object({})
})

//read-files tool
export const readFiles = tool(async ({ files }) => {
    console.log('===========================')
    console.log('using read files tool')
    console.log('files:', files)
    console.log('===========================')

    try {
        const response = await axios.get(
            'http://127.0.0.1/read-files?files=' + files.join(','),
            {
                headers: {
                    Host: '01a09b0d-b734-71b6-b1ed-8e48f584fc7e.agent.localhost'
                }
            }
        )

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
export const updateFiles=tool(async({files})=>
{
    console.log('===========================')
    console.log('using update files tool')
    console.log('FILES:', files)
    console.log('===========================')

    const response=await axios.patch(
        'http://127.0.0.1/update-files',
        {
            updates: files
        },
        {
            headers: {
                Host: '01a09b0d-b734-71b6-b1ed-8e48f584fc7e.agent.localhost'
            }
        }
    )

    return JSON.stringify('updated response:' ,response.data.results)
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

