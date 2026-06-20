// Name: Gamepad
// ID: Gamepad
// Description: Directly access gamepads instead of just mapping buttons to keys.
// License: MIT AND MPL-2.0

(function (Scratch) {
  "use strict";

  const DEFAULT_AXIS_DEADZONE = 0.1;
  let axisDeadzone = DEFAULT_AXIS_DEADZONE;
  const BUTTON_DEADZONE = 0.05;

  /** Normalize Xbox controllers so ChromeOS behaves like Windows */
  function normalizeGamepad(gamepad) {
    let axes = gamepad.axes.slice();
    let buttons = gamepad.buttons.map(b => ({
      value: b.value,
      pressed: b.pressed
    }));

    // ChromeOS / non-standard mappings
    if (gamepad.mapping !== "standard") {
      // Typical ChromeOS Xbox layout:
      // axes 0,1 = left stick
      // axes 2,3 = triggers
      // axes 4,5 = right stick
      // axes 6,7 = d-pad

      if (axes.length >= 6) {
        axes = [
          axes[0] || 0, axes[1] || 0, // left stick
          axes[4] || 0, axes[5] || 0  // right stick
        ];
      }

      // Triggers → buttons 7 & 8
      const lt = Math.max(0, gamepad.axes[2] || 0);
      const rt = Math.max(0, gamepad.axes[3] || 0);

      buttons[6] = { value: lt, pressed: lt > 0.5 };
      buttons[7] = { value: rt, pressed: rt > 0.5 };

      // D-pad → buttons 13–16
      const dx = gamepad.axes[6] || 0;
      const dy = gamepad.axes[7] || 0;

      buttons[12] = { pressed: dy < -0.5, value: dy < -0.5 ? 1 : 0 }; // up
      buttons[13] = { pressed: dy >  0.5, value: dy >  0.5 ? 1 : 0 }; // down
      buttons[14] = { pressed: dx < -0.5, value: dx < -0.5 ? 1 : 0 }; // left
      buttons[15] = { pressed: dx >  0.5, value: dx >  0.5 ? 1 : 0 }; // right
    }

    return { axes, buttons };
  }

  let gamepadState = [];

  const updateState = () => {
    const gamepads = navigator.getGamepads();
    const oldState = gamepadState;

    gamepadState = gamepads.map((gamepad, index) => {
      if (!gamepad) return null;

      const result = {
        id: index,
        realGamepad: gamepad,
        timestamp: gamepad.timestamp,
        axisDirections: [],
        axisMagnitudes: [],
        axisValues: [],
        buttonValues: [],
        buttonPressed: [],
      };

      const oldResult = oldState[index];
      const { axes, buttons } = normalizeGamepad(gamepad);

      for (let i = 0; i < axes.length; i += 2) {
        const x = axes[i] || 0;
        const y = axes[i + 1] || 0;
        const magnitude = Math.sqrt(x ** 2 + y ** 2);

        if (magnitude > axisDeadzone) {
          let direction = (Math.atan2(y, x) * 180) / Math.PI + 90;
          if (direction < 0) direction += 360;

          result.axisDirections.push(direction, direction);
          result.axisMagnitudes.push(magnitude, magnitude);
          result.axisValues.push(x, y);
        } else {
          const oldDir = oldResult ? oldResult.axisDirections[i] : 90;
          result.axisDirections.push(oldDir, oldDir);
          result.axisMagnitudes.push(0, 0);
          result.axisValues.push(0, 0);
        }
      }

      for (let i = 0; i < buttons.length; i++) {
        let value = buttons[i]?.value || 0;
        if (value < BUTTON_DEADZONE) value = 0;
        result.buttonValues.push(value);
        result.buttonPressed.push(!!buttons[i]?.pressed);
      }

      return result;
    });
  };

  window.addEventListener("gamepadconnected", updateState);
  window.addEventListener("gamepaddisconnected", updateState);

  Scratch.vm.runtime.on("BEFORE_EXECUTE", updateState);

  const getGamepads = (index) => {
    if (index === "any") return gamepadState.filter(Boolean);
    return gamepadState[Scratch.Cast.toNumber(index) - 1]
      ? [gamepadState[Scratch.Cast.toNumber(index) - 1]]
      : [];
  };

  const isButtonPressed = (g, b) =>
    b === "any" ? g.buttonPressed.some(Boolean) : !!g.buttonPressed[b - 1];

  const getButtonValue = (g, b) => g.buttonValues[b - 1] || 0;
  const getAxisValue = (g, a) => g.axisValues[a - 1] || 0;
  const getAxisPairMagnitude = (g, a) => g.axisMagnitudes[a - 1] || 0;
  const getAxisPairDirection = (g, a) => g.axisDirections[a - 1] || 90;

  class GamepadExtension {
    getInfo() {
      return {
        id: "Gamepad",
        name: "Gamepad",
        blocks: [
          { opcode: "gamepadConnected", blockType: Scratch.BlockType.BOOLEAN, text: "gamepad [pad] connected?", arguments: { pad: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "buttonDown", blockType: Scratch.BlockType.BOOLEAN, text: "button [b] on pad [i] pressed?", arguments: { b: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "buttonMenu" }, i: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "buttonValue", blockType: Scratch.BlockType.REPORTER, text: "value of button [b] on pad [i]", arguments: { b: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "buttonMenu" }, i: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "axisValue", blockType: Scratch.BlockType.REPORTER, text: "value of axis [b] on pad [i]", arguments: { b: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "axisMenu" }, i: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "axisDirection", blockType: Scratch.BlockType.REPORTER, text: "direction of axes [axis] on pad [pad]", arguments: { axis: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "axesGroupMenu" }, pad: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "axisMagnitude", blockType: Scratch.BlockType.REPORTER, text: "magnitude of axes [axis] on pad [pad]", arguments: { axis: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "axesGroupMenu" }, pad: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "rumble", blockType: Scratch.BlockType.COMMAND, text: "rumble strong [s] and weak [w] for [t] sec. on pad [i]", arguments: { s: { type: Scratch.ArgumentType.NUMBER, defaultValue: "0.25" }, w: { type: Scratch.ArgumentType.NUMBER, defaultValue: "0.5" }, t: { type: Scratch.ArgumentType.NUMBER, defaultValue: "0.25" }, i: { type: Scratch.ArgumentType.NUMBER, defaultValue: "1", menu: "padMenu" } } },
          { opcode: "setAxisDeadzone", blockType: Scratch.BlockType.COMMAND, text: "set axis deadzone to [DEADZONE]", arguments: { DEADZONE: { type: Scratch.ArgumentType.NUMBER, defaultValue: DEFAULT_AXIS_DEADZONE.toString() } } }
        ],
        menus: {
          padMenu: { acceptReporters: true, items: ["any", "1", "2", "3", "4"] },
          buttonMenu: { acceptReporters: true, items: ["any","1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16"] },
          axisMenu: { acceptReporters: true, items: ["1","2","3","4"] },
          axesGroupMenu: { acceptReporters: true, items: [{ text: "Left stick (1 & 2)", value: "1" }, { text: "Right stick (3 & 4)", value: "3" }] }
        }
      };
    }

    gamepadConnected({ pad }) { return getGamepads(pad).length > 0; }
    buttonDown({ b, i }) { return getGamepads(i).some(g => isButtonPressed(g, b)); }
    buttonValue({ b, i }) { return Math.max(...getGamepads(i).map(g => getButtonValue(g, b)), 0); }
    axisValue({ b, i }) { return getGamepads(i).reduce((a, g) => Math.abs(getAxisValue(g, b)) > Math.abs(a) ? getAxisValue(g, b) : a, 0); }
    axisDirection({ axis, pad }) { return getGamepads(pad)[0] ? getAxisPairDirection(getGamepads(pad)[0], axis) : 90; }
    axisMagnitude({ axis, pad }) { return getGamepads(pad).reduce((m, g) => Math.max(m, Math.sqrt(getAxisValue(g, axis) ** 2 + getAxisValue(g, +axis + 1) ** 2)), 0); }

    rumble({ s, w, t, i }) {
      for (const { realGamepad } of getGamepads(i)) {
        realGamepad.vibrationActuator?.playEffect("dual-rumble", {
          duration: t * 1000,
          strongMagnitude: s,
          weakMagnitude: w
        });
      }
    }

    setAxisDeadzone({ DEADZONE }) {
      axisDeadzone = Scratch.Cast.toNumber(DEADZONE);
      updateState();
    }
  }

  Scratch.extensions.register(new GamepadExtension());
})(Scratch);
