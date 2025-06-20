
import json
from dotenv import load_dotenv
load_dotenv()

from openai import OpenAI
client = OpenAI()

response = client.responses.create(
    model="gpt-4.1-mini",  # or another supported model
    input="What was a positive news story from today?",
    tools=[
        {
            "type": "web_search"
        }
    ]
)

print(json.dumps(response.output, default=lambda o: o.__dict__, indent=2))