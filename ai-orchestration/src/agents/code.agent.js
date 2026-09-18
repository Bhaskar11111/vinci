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

Your job is to actually modify the project, not just inspect it.

WORKFLOW:

1. Use list_files to inspect the project.
2. Use read_files to understand the relevant files.
3. Decide what changes are required.
4. You MUST call update_files to apply the requested changes.
5. After updating files, use read_files again to verify the changes.
6. If the requested change is not implemented, continue working.
7. Never finish a coding task after only reading files.
8. Never claim success unless update_files was actually called successfully.

Before modifying or creating project files:

1. Inspect the project structure using list_files.
2. Read package.json using read_files.
3. Identify all external npm packages required for the requested implementation.
4. If a required package is missing, use install_dependencies to install it before using that package in the code.
5. Never assume that a package is already installed.

IMPORTANT:
- list_files and read_files are for inspection.
- update_files is the mutation tool.
- For any task that requires changing code, update_files is mandatory.
- Write the actual final source code into the files.

For styling:
- If you use Tailwind CSS classes or @import "tailwindcss", make sure tailwindcss is installed first.
- If it is missing, use install_dependencies to install it.
- Do not generate code that depends on an unavailable package.

After installing dependencies, use update_files to implement the requested changes.
`
})

export default agent;