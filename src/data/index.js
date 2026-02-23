import abilities from "./abilities.json";
import armour from "./armour.json";
import equipment from "./equipment.json";
import factions from "./factions.json";
import injuries from "./injuries.json";
import models from "./models.json";
import skills from "./skills.json";
import weaponsMelee from "./weapons_melee.json";
import weaponsRanged from "./weapons_ranged.json";

function getOrThrow(table, id, type) {
  const result = table[id];
  if (!result) throw new Error(`Missing ${type} id=${id}`);
  return result;
}

export function createDb() {
  return {
    abilities,
    armour,
    equipment,
    factions,
    injuries,
    models,
    skills,
    weaponsMelee,
    weaponsRanged,
    getAbility: (id) => getOrThrow(abilities, id, "ability"),
    getArmour: (id) => getOrThrow(armour, id, "armour"),
    getEquipment: (id) => getOrThrow(equipment, id, "equipment"),
    getFaction: (id) => getOrThrow(factions, id, "faction"),
    getInjury: (id) => getOrThrow(injuries, id, "injury"),
    getModel: (id) => getOrThrow(models, id, "model"),
    getSkill: (id) => getOrThrow(skills, id, "skill"),
    getWeaponMelee: (id) => getOrThrow(weaponsMelee, id, "weaponMelee"),
    getWeaponRanged: (id) => getOrThrow(weaponsRanged, id, "weaponRanged"),
  };
}
