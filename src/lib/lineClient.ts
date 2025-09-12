import { Client } from '@line/bot-sdk';

const config = {
  channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN || 'R5yfjCfXN1KInTj5p8AoROyRmVzCJMCQ+0HDb5Q3Ol5yuksaC77nXNoVa2SLK9CXwvq3ixXDtzo//kpkxLp4sbPkgg/yYNWCeLgNCAt5PqfWPuyQPJ2LqynetooGaDY9SEipi2Xq/01wFtQKjxpACAdB04t89/1O/w1cDnyilFU=',
  channelSecret: process.env.LINE_CHANNEL_SECRET || 'ec3e1c92ae6154edd4b59c9c3cb4a62c',
};

export const lineClient = new Client(config);
