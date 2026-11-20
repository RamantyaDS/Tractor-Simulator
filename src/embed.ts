// Set by the Traknus World (github.com/RamantyaDS/Traknus-World) when it mounts this simulator as one zone of the
// shared world. `on`: the world owns the sky, lights, fog and post effects, so the zone leaves out its own and its
// backdrop. `input`: the keyboard and gamepad reach this simulator only while the player is at the controls.
// On this site both stay at their defaults and nothing changes.
export const EMBED = { on: false, input: true };
