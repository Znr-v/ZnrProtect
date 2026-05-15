import { BotContext } from "../index";

export function startWorkers(_ctx: BotContext) {
  // BullMQ workers can be added here for heavy processing
  // For now the bot processes events inline
  console.log("[+] Workers prêts");
}
