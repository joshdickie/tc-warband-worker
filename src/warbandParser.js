/**
 * What we want:
 * Warband Name
 * Warband Faction
 * Warband Subfaction
 * For each Model:
 *  Name
 *  Movement
 *  Melee
 *  Ranged
 *  Armour
 *  Keywords
 *  Battlekit:
 *    Ranged Weapons
 *      Name
 *      Range
 *      Keywords
 *      Special
 *    Grenades
 *      Name
 *      Range
 *      Keywords
 *      Special
 *    Melee Weapons
 *      Name
 *      Range
 *      Keywords
 *      Special
 *    Armour
 *      Name
 *      Keywords
 *      Special
 *    Shields
 *      Name
 *      Keywords
 *      Special
 *    Equipment
 *      Name
 *      Keywords
 *      Special
 *    Special
 *      Name
 *      Keywords
 *      Special
 *  Abilities
 *    Name
 *    Description
 *  Upgrades/Goetics/etc (rolled into Abilities)
 *  Advancements
 *    Name
 *    Description
 *  Injuries
 *    Name
 *    Description
 */

/**
 * Everything's meant to be in like lookup tables so I think we need to get an array of object IDs
 * and then go through that array grabbing whatever bits and bobs we find and applying keywords.
 */

import { createDb } from "./data.js";
import { modifiers } from "./modifiers.js";
const db = createDb();

export function parseWarband(data) {
  const warbandData = JSON.parse(data.warband_data);
  const warbandName = warbandData.name;
  const factionId = warbandData.faction.faction_property.object_id;
  const factionDb = db.forFaction(factionId);
  const factionName = factionDb.getFactionName();

  const models = warbandData.models.map(model => {
    const modelId = model.model;
    let modelEntry = factionDb.getModel(modelId);
    modelEntry = {
      ...modelEntry,
      name: model.name,
      meleeWeapons: [],
      rangedWeapons: [],
      armour: [],
      abilities: [],
      skills: [],
      injuries: []
    };

    // loop through subproperties, equipment, upgrades, skills, and injuries
    // if they have modifiers, pass those through to the modifiers handler
    // add to the appropriate array
    
    // format modelEntry object into formatted string, so we end up with:
    /**
     * {
     *   title: String; // model name in TTS
     *   body: String; // model tooltip in TTS
     *   decisions: Array; // decisions to be made at runtime in TTS
     * }
     */

    return modelEntry;
  });

  return {
    warbandName,
    factionName,
    model: models[0]
  }
}


/**
 * Synod Model Object Shape:
 * 
 * {
 *  name: String;
 *  model: String; // model id
 *  subproperties: [ // these are like faction rules as well as abilities
 *    {
 *      object_id: String; // ability id
 *    }
 *  ];
 *  equipment: [
 *    {
 *      equipment: {
 *        equipment_id: {
 *          object_id: String // equipment id
 *          tags: {
 *            armour?: boolean
 *            weapon?: boolean
 *            shield?: boolean
 *          }
 *        }
 *      }
 *    }
 *  ]
 *  list_upgrades: [
 *    {
 *      upgrade: {
 *        object_id: String;
 *        selections: [
 *          {
 *            suboption: {
 *              object_id: String;
 *            }
 *          }
 *        ]
 *      }
 *    } 
 *  ]
 *  list_skills: [
 *    {
 *      upgrade: {
 *        object_id: String;
 *        selections: [
 *          {
 *            suboption: {
 *              object_id: String;
 *            }
 *          }
 *        ]
 *      }
 *    } 
 *  ]
 *  list_injury: [
 *    {
 *      upgrade: {
 *        object_id: String;
 *        selections: [
 *          {
 *            suboption: {
 *              object_id: String;
 *            }
 *          }
 *        ]
 *      }
 *    } 
 *  ]
 * }
 */