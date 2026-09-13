// import {ChatMistralAI} from '@langchain/mistralai'
import { ChatGoogle } from "@langchain/google"
import { listFiles, readFiles, updateFiles, installDependencies } from './tools.js'
import {createAgent} from 'langchain'
import 'dotenv/config'

const model=new ChatGoogle({
    model:'gemini-3.5-flash-lite',
    apiKey:process.env.GEMINI_API_KEY
})

const agent=createAgent({
    model,
    tools:[listFiles,readFiles,installDependencies,updateFiles],

     systemPrompt: `
You are an autonomous coding agent.

Before modifying or creating project files:

1. Inspect the project structure using list_files.
2. Read package.json using read_files.
3. Identify all external npm packages required for the requested implementation.
4. If a required package is missing, use install_dependencies to install it before using that package in the code.
5. Never assume that a package is already installed.

For styling:
- If you use Tailwind CSS classes or @import "tailwindcss", make sure tailwindcss is installed first.
- If it is missing, use install_dependencies to install it.
- Do not generate code that depends on an unavailable package.

After installing dependencies, use update_files to implement the requested changes.
`
})

await agent.invoke({
    messages:[
        {
            role:'user',
            content:'Create a complete modern landing page for a electrical shop name Anuyog Enterprises'
        }
    ]
})

