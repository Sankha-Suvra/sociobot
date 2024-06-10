import connectDb from '../config/db.js'
import userModel from '../models/User.js'
import eventModel from '../models/Event.js'
import TelegramBot from 'node-telegram-bot-api';
import fetch from 'node-fetch'
 
const apiKey = process.env.GEMINI_API_KEY;
const baseURL = 'https://api.gemini.ai/v1';
const botToken = process.env.TELEGRAM_BOT_API;

console.log('Bot Token:', botToken);  
console.log('Gemini API Key:', apiKey);

const bot = new TelegramBot(botToken, { polling: true, request: { verbose: true } });


const handleWelcomeMessage = async (msg) => {
    const from = msg.from
  
    // Connect to database (assuming connectDb is a function)
    await connectDb();
  
    try {
      // Find or create user (upsert)
      const user = await userModel.findOneAndUpdate({ tgId: from.id }, {
        $setOnInsert: { 
          firstName: from.first_name,
          lastName: from.last_name,
          isBot: from.is_bot,
          username: from.username,
        },
      }, { upsert: true, new: true }); // Return updated user
      console.log(user.firstName);
      await bot.sendMessage(from.id, `Hi! ${user.firstName}, welcome. I will be writing highly engaging media posts for you  just keep feeding me with the events throughout the day. let's shine on social media`);
    } catch (error) {
      console.error('Error:', error);
      await bot.sendMessage('facing difficulties...');
    }
  };
  
const handleGenerateCommand = async (msg) => {
    const from = msg.from
  
    const startOfTheDay = new Date();
    startOfTheDay.setHours(0, 0, 0, 0);
  
    const endOfTheDay = new Date();
    endOfTheDay.setHours(23, 59, 59, 999);
  
    // Get events for the user post
    const events = await eventModel.find({
      tgId: from.id,
      createdAt: {
        $gte: startOfTheDay,
        $lte: endOfTheDay,
      },
    });

    if (events.length === 0) {
        await bot.sendMessage('No events found for the day');
        return;
      }
    
      try {
        // Generate social media posts using Gemini API
        const prompt = `Act as a senior copywriter, you write highly engaging posts for Linkedin, Facebook and Twitter using provided thoughts/events throughout the day.
            
            write like a human, for humans. Craft three engaging social media posts tailored for Linkedin, Facebook, Twitter audiences. Use simple language. Use given labels just to understand the order of the event, don't mention the time in the posts. Each posts should creatively highlight the following events: ${events.map((event) => event.text).join(', ')}`;
        const model = 'gemini-pro';
    
        const response = await fetch(`${baseURL}/text-generation`, {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            prompt,
            model,
          }),
        });
        const data = await response.json();
    
        console.log('completion: ', data.text);
    
    
        await bot.sendMessage(data.text);
      } catch (error) {
        console.error('Error:', error);
        await bot.sendMessage(from.id, 'Facing difficulties...');
      }
    };
    
    const handleTextMessage = async (ctx) => {
      const from = msg.from;
      const message = msg.text;
    
      try {
        await eventModel.create({
          text: message,
          tgId: from.id,
        });
        await bot.sendMessage('Noted , keep texting me your thoughts to help me generate the posts, enter command: /generate to generate post');
      } catch (error) {
        console.error('Error:', error);
        await bot.sendMessage('facing difficulties...');
      }
    };
    
    bot.onText(/\/generate/, handleGenerateCommand);
    
    bot.on('message', (ctx => {
        if (msg.text === '/start') {
            handleWelcomeMessage(msg);
        } else{
            handleTextMessage(msg);
        }
    }));