import data from "./db.json"

function getOrThrow(table, path) {
  if (typeof path !== "string" || path.length === 0) {
    throw new Error(`Can not pull data with empty path`);
  }

  const parts = path.replace(/^./, "").split(".");

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
    // getAbility: (id) => getOrThrow(abilities, id, "ability"),
    // getArmour: (id) => getOrThrow(armour, id, "armour"),
    // getEquipment: (id) => getOrThrow(equipment, id, "equipment"),
    // getFaction: (id) => getOrThrow(factions, id, "faction"),
    // getInjury: (id) => getOrThrow(injuries, id, "injury"),
    // getModel: (id) => getOrThrow(models, id, "model"),
    // getSkill: (id) => getOrThrow(skills, id, "skill"),
    // getWeaponMelee: (id) => getOrThrow(weaponsMelee, id, "weaponMelee"),
    // getWeaponRanged: (id) => getOrThrow(weaponsRanged, id, "weaponRanged"),
  };
}
