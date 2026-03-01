import data from "./db.json"

function getOrThrow(table, path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new Error(`Can not pull data with empty path`);
  }

  const parts = path.replace(/^\./, "").split(".");

  let current = table;

  for (const part of parts) {
    if (
      current === null ||
      current === undefined ||
      typeof current !== "object" ||
      !(part in current)
    ) {
      throw new Error(`Missing data: "${path}" failed at "${part}"`);
    }

    current = current[part];
  }

  return current;
}

export function createDb() {
  return {
    data,

    getAbility: (id) => getOrThrow(data, `modifiers.abilities.${id}`),
    getInjury: (id) => getOrThrow(data, `modifiers.injuries.${id}`),
    getSkill: (id) => getOrThrow(data, `modifiers.skills.${id}`),

    forFaction: (factionId) => {
      const faction = getOrThrow(data, `factions.${factionId}`);
      const battlekit = getOrThrow(faction, "battlekit")

      return {
        getFactionName: () => getOrThrow(faction, "name"),
        getModel: (id) => getOrThrow(faction, `models.${id}`),
        getArmour: (id) => getOrThrow(battlekit, `armour.${id}`),
        getEquipment: (id) => getOrThrow(battlekit, `equipment.${id}`),
        getWeapon: (id) => getOrThrow(battlekit, `weapons.${id}`),
      };
    },
  };
}
