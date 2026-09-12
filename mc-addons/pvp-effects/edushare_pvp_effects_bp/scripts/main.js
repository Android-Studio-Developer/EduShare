import { world } from "@minecraft/server";

// Kill reward pool — every status effect in the base game, good and bad.
// It's a chaos mechanic on purpose: you never know what a kill hands you.
const EFFECT_POOL = [
  "speed", "slowness", "haste", "mining_fatigue", "strength", "jump_boost",
  "nausea", "regeneration", "resistance", "fire_resistance", "water_breathing",
  "invisibility", "blindness", "night_vision", "hunger", "weakness", "poison",
  "wither", "health_boost", "absorption", "saturation", "levitation", "slow_falling",
];

const KILL_EFFECT_DURATION_TICKS = 20 * 30; // 30 seconds

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

world.afterEvents.entityDie.subscribe((event) => {
  const { deadEntity, damageSource } = event;

  // Victim loses exactly one random effect they were carrying at death.
  if (deadEntity?.isValid()) {
    const effects = deadEntity.getEffects();
    if (effects.length > 0) {
      const lost = effects[randomInt(0, effects.length - 1)];
      const lostId = lost.typeId;
      deadEntity.removeEffect(lostId);
      if (deadEntity.typeId === "minecraft:player") {
        deadEntity.onScreenDisplay.setActionBar(`§cLost effect: ${lostId.replace("minecraft:", "")}`);
      }
    }
  }

  // The killer gets a random effect at amplifier 1-6.
  const killer = damageSource?.damagingEntity;
  if (killer?.isValid() && killer.typeId === "minecraft:player") {
    const effectId = EFFECT_POOL[randomInt(0, EFFECT_POOL.length - 1)];
    const amplifier = randomInt(1, 6);
    killer.addEffect(effectId, KILL_EFFECT_DURATION_TICKS, { amplifier, showParticles: true });
    killer.onScreenDisplay.setActionBar(`§aKill reward: ${effectId} ${amplifier}`);
  }
});
