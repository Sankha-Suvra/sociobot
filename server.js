import { GoogleGenerativeAI } from "@google/generative-ai";
import { Telegraf } from "telegraf";
import userModel from './models/User.js'
import eventModel from './models/Event.js'
import connectDb from './config/db.js'
import { message } from "telegraf/filters";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY)
const generationConfig = {temperature: 0.9, topP: 1, topK: 1, maxOutputToken: 4096}
const model = genAI.getGenerativeModel({ model: "gemini-pro"});

const bot = new  Telegraf(process.env.TELEGRAM_BOT_API);
const apiKey = process.env.GEMINI_API_KEY;
const baseURL = 'https://api.gemini.ai/v1';


try {
    connectDb();
    console.log("database connected");
} catch (error) {
    console.log(err);
    process.kill(process.pid, 'SIGTERM ')
    }

bot.start(async (ctx)=>{

    const from = ctx.update.message.from;

    console.log("from", from);

    try {
        await userModel.findOneAndUpdate({tgId : from.id}, {
            $setOnInsert: {
                firstName: from.first_name,
                astName: from.last_name,
                isBot: from.is_bot,
                username: from.username 
            }
        },
        {upsert: true, new: true}
    )
        await ctx.reply(`Hi! ${from.first_name}, welcome. I will be writing highly engaging media posts for you 😄 just keep feeding me with the events throughout the day. let's shine on socia media`     
        )
    } catch (err) {
        console.log(err);
        await ctx.reply("facing difficulties")
    }


    //store userinfo in DB
    
    
})

bot.command('generate', async (ctx) =>{

    const from = ctx.update.message.from;


    const startOfTheDay = new Date();
    startOfTheDay.setHours(0, 0, 0, 0);

    const endOfTheDay = new Date()
    endOfTheDay.setHours(23, 59, 59, 999);

    //get events for the user post

    const events = await eventModel.find({
        tgId: from.id,

        createdAt:{
            $gte: startOfTheDay,
            $lte: endOfTheDay
        }
    })

    if(events.length === 0){
        await ctx.reply('No events found for the day')
        return;
    }
    //make openai api call

    // try {
    //     const chatCompletion = await openai.chat.completions.create({
    //         messages: [
    //             {
    //                 role: 'system',
    //                 content: 'Act as a senior copywriter, you write highly engaging posts for linkedin, facebook and twitter using provided thoughts/events throughout the day.'
    //             },
    //             {
    //                 role: 'user',
    //                 content: `write like a human, for humans. Craft three engaging social media posts tailored for Linkedin, Facebook, Twitter audiences. Use simple language. Use given labels just to understand the order of the event, don't mention the time in the posts. Each posts should creatively highlight the following events. Ensure the tone is conversational and impactful. Focus on engaging the respective platform's audience, encouraging interaction and driving interest in the events: ${events.map((event)=> event.text).join(', ')}`
    //             },
    //         ],
    //         model: process.env.OPENAI_MODEL
    //     })

    //     console.log('completion: ',chatCompletion);

    //     //store token count
    //     await userModel.findOneAndUpdate({
    //         tgId: from.id
    //     },{
    //         $inc:{
    //             promptTokens: chatCompletion.usage.prompt_tokens,
    //             completionTokens: chatCompletion.usage.completion_tokens
    //         }
    //     })
    //     await ctx.reply(chatCompletion.choices[0].message.content)
    // } catch (error) {
    //     console.log('facing difficulties', error);
    // }

    
    try {
        // Generate social media posts using Gemini API
        const prompt = `Act as a senior copywriter, you write highly engaging posts for Linkedin, Facebook and Twitter using provided thoughts/events throughout the day.
            
            write like a human, for humans. Craft three engaging social media posts tailored for Linkedin, Facebook, Twitter audiences. Use simple language. Use given labels just to understand the order of the event, don't mention the time in the posts. Each posts should creatively highlight the following events: ${events.map((event) => event.text).join(', ')}`;
    
        // const response = await fetch(`${baseURL}/text-generation`, {
        //   method: 'POST',
        //   headers: {
        //     Authorization: `Bearer ${apiKey}`,
        //     'Content-Type': 'application/json',
        //   },
        //   body: JSON.stringify({
        //     prompt,
        //     model,
        //   }),
        // });
        // const data = await response.json();
    
        // console.log('completion: ', data.text);
        const result = await model.generateContent(prompt)
        const response = await result.response
    
        await ctx.reply(response.text());
      } catch (error) {
        console.error('Error:', error);
        await ctx.reply(from.id, 'Facing difficulties...');
      }

    //send response
});



bot.on(message('text'), async(ctx) =>{
    const from = ctx.update.message.from;
    const message = ctx.update.message.text;

    try {
        await eventModel.create({
            text: message,
            tgId: from.id,
        })
        await ctx.reply('Noted 📝, keep texting me your thoughts to help me generate the posts, enter command: /generate to generate post'

        );
    } catch (error) {
        console.log(error);
        await ctx.reply('facing difficulties...')
    }

    
});



bot.launch()

// Enable graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'))
process.once('SIGTERM', () => bot.stop('SIGTERM'))