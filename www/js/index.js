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

// Wait for the deviceready event before using any of Cordova's device APIs.
// See https://cordova.apache.org/docs/en/latest/cordova/events/events.html#deviceready
document.addEventListener('deviceready', onDeviceReady, false);

function onDeviceReady() {
    // Cordova is now initialized. Have fun!

    console.log('Running cordova-' + cordova.platformId + '@' + cordova.version);
    document.getElementById('deviceready').classList.add('ready');
}


const stick = document.querySelector('.stick');
const container = document.querySelector('.joystick');
// Get the dimensions of the container
const cwidth = container.offsetWidth; // Since it's a square, height = width
const cmiddle = cwidth / 2 ;

var servo = 0 ; // position des servomoteurs
var motor = 1;
dragElement(stick);

function dragElement(elmnt) {
  let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;

  elmnt.onmousedown = dragMouseDown;

  function dragMouseDown(e) {
    e = e || window.event;
    e.preventDefault();
    // Get the mouse cursor position at the start
    pos3 = e.clientX;
    pos4 = e.clientY;
    document.onmouseup = closeDragElement;
    // Call a function whenever the cursor moves
    document.onmousemove = elementDrag;
  }

  function elementDrag(e) {
    e = e || window.event;
    e.preventDefault();
    // Calculate the new cursor position
    pos1 = pos3 - e.clientX;
    pos2 = pos4 - e.clientY;
    pos3 = e.clientX;
    pos4 = e.clientY;

    // Calculate new position of the `stick`
    let newTop = elmnt.offsetTop - pos2;
    let newLeft = elmnt.offsetLeft - pos1;

    // Constrain the `stick` within the `joystick` container boundaries
    const minLeft = 46; // Adjusted to allow offset for full bottom-left position
    const maxLeft = container.offsetWidth + 50 - elmnt.offsetWidth; // Right boundary with offset
    const minTop = 46; // Adjusted to allow offset for full bottom-left position
    const maxTop = container.offsetHeight + 50 - elmnt.offsetHeight; // Bottom boundary with offset

    newTop = Math.min(Math.max(newTop, minTop), maxTop);
    newLeft = Math.min(Math.max(newLeft, minLeft), maxLeft);

    // Set the new position
    elmnt.style.top = newTop + "px";
    elmnt.style.left = newLeft + "px";
    console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);
    

    //RightLeft turn movement
    servo = Math.trunc(((stick.offsetLeft / cwidth) * 90) + 45);

    if (90 < servo && servo < 100) {
        servo = 90;
    } else {
        servo = servo;
    };

    if (stick.offsetTop < (cmiddle + 20)) {
        motor = 1;
    } else if (stick.offsetTop > (cmiddle + 20)){
        motor = -1;
    } else {
        motor = 0;
    };
    console.log(`Servo : ${servo}, Motors : ${motor}`);
  };

  function closeDragElement() {
    // Stop moving when mouse button is released
    document.onmouseup = null;
    document.onmousemove = null;
    elmnt.style.left = cmiddle + 20 + "px";
    elmnt.style.top = cmiddle + 20 + "px";
    console.log(`Stick position X: ${stick.offsetLeft}, Stick position Y: ${stick.offsetTop}`);
    servo = 90;
    motor = 0;
    console.log(`Servo : ${servo}, Motors : ${motor}`);
  }
}
