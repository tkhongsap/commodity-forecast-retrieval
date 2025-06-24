import os
from dotenv import load_dotenv
load_dotenv()

from openai import OpenAI
client = OpenAI()


completion = client.chat.completions.create(
    model="gpt-4.1",
    web_search_options={},
    messages=[
        {
            "role": "user",
            "content": "what is the current price of crude oil today? Also, please find me forecast for the next 30 days for crude oil price and sources",
        }
    ],
)

print(completion.choices[0].message.content)

