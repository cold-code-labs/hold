import { createProject, listProjects } from "./provision";

const [cmd, arg] = process.argv.slice(2);

async function main() {
  switch (cmd) {
    case "create": {
      if (!arg) throw new Error("usage: cli create <name>");
      const res = await createProject(arg);
      console.log(JSON.stringify(res, null, 2));
      break;
    }
    case "list":
      console.log(JSON.stringify(await listProjects(), null, 2));
      break;
    default:
      console.log("usage: cli <create <name> | list>");
  }
  process.exit(0);
}

main().catch((e) => {
  console.error("ERROR:", e.message);
  process.exit(1);
});
