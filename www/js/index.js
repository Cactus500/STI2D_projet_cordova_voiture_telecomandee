/*
 * Licensed to the Apache Software Foundation (ASF) under one
 * or more contributor license agreements.  See the NOTICE file
 * distributed with this work for additional information
 * regarding copyright ownership.  The ASF licenses this file
 * to you under the Apache License, Version 2.0 (the
 * "License"); you may not use this file except in compliance
 * with the License.  You may obtain a copy of the License at
 *
 * http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing,
 * software distributed under the License is distributed on an
 * "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
 * KIND, either express or implied.  See the License for the
 * specific language governing permissions and limitations
 * under the License.
 */


// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
// Wait for the deviceready event before using any of Cordova's device APIs.
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!
    if (typeof bluetoothSerial === 'undefined') {
        console.error("bluetoothSerial is not defined. Ensure the Cordova Bluetooth Serial plugin is installed.");
        return;
    }

    bluetoothSerial.isEnabled(
        function() { 
            console.log("Bluetooth is enabled.");
            document.querySelector('.bluetooth').style.backgroundColor = '#0095FF';
        },
        function() { 
            console.log("Bluetooth is not enabled."); 
            document.querySelector('.bluetooth').style.backgroundColor = '#C3C3C3';
        }
    );

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');
}

// Initialize AudioContext
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// Resume AudioContext on user interaction
document.addEventListener('click', () => {
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log('AudioContext resumed');
        });
    }
});

function playNote(frequency, duration) {
    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain(); // Create a GainNode for volume control

    oscillator.type = 'square';
    oscillator.frequency.value = frequency; // Frequency in hertz

    gainNode.gain.value = 0.5; // Set volume (adjust as needed)

    // Connect oscillator to gain node, then to destination
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();

    setTimeout(() => {
        oscillator.stop();
    }, duration);
}

// Add a test button handler to play a test sound
document.getElementById('testSound').addEventListener('click', () => {
    playNote(440, 1000); // Play a 440 Hz sound for 1 second
});

const stick = document.querySelector('.stick');
const container = document.querySelector('.joystick');
// Get the dimensions of the container
const cwidth = container.offsetWidth; // Since it's a square, height = width
const cmiddle = cwidth / 2;

var servo = 0; // Position des servomoteurs
var motor = 1;
dragElement(stick);

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  elmnt.onmousedown = dragMouseDown;
  elmnt.ontouchstart = touchStart;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // Get the mouse cursor position at the start
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    document.onmousemove = elementDrag;
  }

  function touchStart(e) {
    e.preventDefault();
    // Get the touch position at the start
    pos3 = e.touches[0].clientX;
    pos4 = e.touches[0].clientY;
    document.ontouchend = closeDragElement;
    document.ontouchmove = elementDrag;
  }
  
  function elementDrag(e) {
    elmnt.style.transition = "none";
    e = e || window.event;
    e.preventDefault();
    // For touch events
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;

    // Calculate the new cursor/touch position
    pos1 = pos3 - clientX;
    pos2 = pos4 - clientY;
    pos3 = clientX;
    pos4 = clientY;

    // Calculate new position of the `stick`
    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;

    // Constrain the `stick` within the `joystick` container boundaries
    const minLeft = 34;
    const maxLeft = container.offsetWidth + 36 - elmnt.offsetWidth;
    const minTop = 34;
    const maxTop = container.offsetHeight + 36 - elmnt.offsetHeight;

    newTop = Math.min(Math.max(newTop, minTop), maxTop);
    newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);

    // Set the new position
    elmnt.style.top = newTop + "px";
    elmnt.style.left = newLeft + "px";

    console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);

    // RightLeft turn movement
    servo = ((stick.offsetLeft / cwidth) * 90) + 45;

    if (90 < servo && servo < 100) {
      servo = 90;
    } else {
      servo = servo;
    }

    if (stick.offsetTop < (cmiddle + 6.5)) {
      motor = 1;
    } else if (stick.offsetTop > (cmiddle + 6.5)) {
      motor = -1;
    } else {
      motor = 0;
    }
    
    console.log(`Servo : ${servo}, Motors : ${motor}`);

    // Send data over Bluetooth
    const dataToSend = JSON.stringify({s: servo, m: motor });
    bluetoothSerial.write(dataToSend,
        function() { 
            console.log("Data sent successfully:", dataToSend); 
            playNote(servo * 10, 1000); // Play note based on servo position
        },
        function(error) { 
            console.error("Error sending data:", error); 
            playNote(0, 1000); // Error sound
        }
    );
  }

  function closeDragElement() {
    // Stop moving when mouse/touch is released
    document.onmouseup = null;
    document.onmousemove = null;
    document.ontouchend = null;
    document.ontouchmove = null;
    elmnt.style.transition = "cubic-bezier(.6,1.55,.65,1) 300ms 0ms";
    elmnt.style.left = cmiddle + 6.5 + "px";
    elmnt.style.top = cmiddle + 6.5 + "px";

    console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);
    servo = 90;
    motor = 0;

    console.log(`Servo : ${servo}, Motors : ${motor}`);

    // Send reset data over Bluetooth
    const resetData = JSON.stringify({ servo: 90, motor: 0 });
    bluetoothSerial.write(resetData,
        function() { 
            console.log("Reset data sent successfully:", resetData); 
            playNote(1200, 100); // Reset sound
        },
        function(error) { 
            console.error("Error sending reset data:", error); 
            playNote(1200, 100); // Error sound
        }
    );
  }
}

const IO = document.querySelector('.IO');
const tip = document.querySelector('.tip');
let isLedOn = false;

IO.addEventListener('click', function () {
    isLedOn = !isLedOn;
    tip.style.left = isLedOn ? '30pt' : '0pt';
    document.getElementById("LED").style.backgroundColor = isLedOn ? '#FFCC00' : '#C3C3C3';
    tip.style.backgroundColor = isLedOn ? '#FFCC00' : '#C3C3C3';

    // Determine LED state
    const ledState = isLedOn ? 1 : 0;

    // Send LED state over Bluetooth
    const ledData = JSON.stringify({ led: ledState });
    bluetoothSerial.write(ledData,
        function () { 
            console.log("LED state sent successfully:", ledData); 
            playNote(isLedOn ? 1000 : 500, 100); // Play note for LED on/off
        },
        function (error) { 
            console.error("Error sending LED state:", error); 
            playNote(1500, 100); // Error sound
        }
    );
});
