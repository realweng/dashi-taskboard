import { isPaseoHost } from "./paseoHost";

export interface HostBrand {
  /** 界面关键字，例如 “Codex 项目总结”。 */
  name: string;
  /** agent 参与者的显示名称。 */
  agentName: string;
  /** web/public 下的品牌 logo。 */
  agentLogo: string;
}

const brands: Record<string, HostBrand> = {
  codex: { name: "Codex", agentName: "Codex Agent", agentLogo: "codex-agent-logo.png" },
  paseo: { name: "Paseo", agentName: "Paseo Agent", agentLogo: "paseo-logo.png" },
};

export function currentHostBrand(): HostBrand {
  return isPaseoHost() ? brands.paseo : brands.codex;
}
