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

export function parseWarband(data) {
  // const warbandName = data.warband_data.warband.name;
  // const factionId = data.warband_data.warband.faction.faction_property.object_id;
  // const models = data.warband_data.warband.models.map(m => m.model);

  // const devResp = {
  //   warbandName,
  //   factionId,
  //   models
  // }
  return JSON.parse(data.warband_data);
}