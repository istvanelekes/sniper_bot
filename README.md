# Getting Started with Sniper Trading Bot
Feel free to watch the demo here: https://www.youtube.com/watch?v=3HLkzDbxRw8 Things you will need: Code editor, Alchemy Account, Metamask account.

## How to use
Assuming you already have your favorite text editor installed: First clone this repository to your code editor by hitting the clone button to the top right. After cloning and opening this project please run:

### 1. npm install
This will install all the dependencies you need to run this project.

### 2. Create and Setup .env
Before running any scripts, you'll want to create a .env file with the following values (see .env.example):

You will need an acount with Alchemy for this next part.

After signing up at alchemy.com https://www.alchemy.com/ you can create a porject. Create it on the mainnet, name it anything you like. Now once we have created a project there is an option called get keys. Click this and we will get a key to use.

We will take this key into our .env.example file. Paste your key where it asks and rename the .env.example. to just .env. This is a hidden file with sensitve information. You do not want to leave that key out for people to see.

- **ALCHEMY_API_KEY=""**
- **PRIVATE_KEY=""** (Private key of the account to recieve profit/execute sniper bot contract)
- **PORT=""** 

### 3. Start Hardhat Node:
In your terminal run:
`npx hardhat node`

Once you've started the hardhat node, copy the private key of the first account as you'll need to paste it in your .env file in the next step.

*As a reminder, do **NOT** use or fund the accounts/keys provided by the hardhat node in a real production setting, they are to be only used in your local testing!*

### 4. Add Private Key to .env
Copy the private key of the first account provided from the hardhat node, and paste in the value for the **PRIVATE_KEY** variable in your .env file

### 5. Deploy Smart Contract
In a separate terminal run:
`npx hardhat run scripts/deploy.js --network localhost`

Sometimes the deployed address may be different when testing, and therefore you'll need to update the **SNIPER_TRADE_ADDRESS** inside of the *config.json* 

### 6. Start the Bot
`node bot.js`

## About config.json
### PROJECT_SETTINGS
Inside the *config.json* file, under the **PROJECT_SETTINGS** object, there are 2 keys that hold a boolean value:
- **isLocal**
- **isDeployed**

Both options depend on how you wish to test the bot. By default both values are set to true. If you set isLocal to false, and then run the bot this will allow the bot to monitor new token events on the actual mainnet, instead of locally. 

isDeployed's value can be set on whether you wish for the SniperTrade contract to be called if a potential new token is found. By default isDeployed is
set to true for local testing. Ideally this is helpful if you want to monitor new tokens on mainnet and you don't have a contract deployed. 

## Technology Stack & Tools

- Solidity (Writing Smart Contract)
- Javascript (React & Testing)
- [Hardhat](https://hardhat.org/) (Development Framework)
- [Ethers.js](https://docs.ethers.io/v5/) (Blockchain Interaction)
- [Alchemy](https://www.alchemy.com/) (Blockchain Connection)
- [Uniswap V3](https://docs.uniswap.org/contracts/v3/overview) (Exchange)