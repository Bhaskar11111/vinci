// import {ChatMistralAI} from '@langchain/mistralai'
import { ChatGoogle } from "@langchain/google"
import { listFiles, readFiles, updateFiles } from './tools.js'
import {createAgent} from 'langchain'
import 'dotenv/config'

const model=new ChatGoogle({
    model:'gemini-3.5-flash-lite',
    apiKey:process.env.GEMINI_API_KEY
})

const agent=createAgent({
    model,
    tools:[listFiles,readFiles,updateFiles]
})

await agent.invoke({
    messages:[
        {
            role:'user',
            content:'add a button in the top right corner which can toggle between light and dark mode'
        }
    ]
})

