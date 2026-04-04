export interface Command {
  id: string;
  label: string;
  command: string;
  group: string;
  color: string;
  icon: string;
  cwd?: string;
  scope?: "global" | "local";
}
