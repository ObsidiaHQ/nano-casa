import { Client, Colors, EmbedBuilder, GatewayIntentBits } from 'discord.js';

export class BotsManager {
  discordClient;

  constructor() {
    this.discordClient = new Client({
      intents: [GatewayIntentBits.Guilds, GatewayIntentBits.DirectMessages],
    });

    this.discordClient
      .login(Bun.env.DISCORD_BOT_TOKEN)
      .then(() => console.log(`Logged in as ${this.discordClient.user.tag}!`));
  }

  async notify(bounty: {
    title: string;
    description: string;
    reward: number;
    deadline: number;
    creator: string;
  }) {
    const user = await this.discordClient.users.fetch(Bun.env.DISCORD_USER_ID, {
      force: true,
    });

    const embed = new EmbedBuilder()
      .setColor(Colors.Fuchsia) // Use a color that represents the bounty well
      .setTitle(`🎯 New Bounty Added: ${bounty.title}`)
      .setDescription(`${bounty.creator} created a new bounty!`)
      .addFields(
        { name: '💰 Reward:', value: `**Ӿ${bounty.reward}**`, inline: true },
        {
          name: '🕒 Deadline:',
          value: bounty.deadline
            ? `<t:${Math.floor(new Date(bounty.deadline).getTime() / 1000)}:D>`
            : 'Open-ended',
          inline: true,
        },
        {
          name: '🔗 More Info:',
          value: `[Click here](https://nano.casa/bounties) to view the bounty details.`,
        },
        {
          name: '📋 Description:',
          value: `${bounty.description || 'Description not provided.'}`,
        }
      )
      .setTimestamp();

    if (user) {
      user
        .send({ embeds: [embed] })
        .then(() => console.log('DM sent successfully'))
        .catch(console.error);
    }
  }
}
