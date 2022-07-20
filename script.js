'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const form = document.querySelector('.form--add');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');
const sortInput = document.querySelector('.workouts__sort--input');
const btnDeleteAll = document.querySelector('.workouts__btn--delete-all');

class Workout {
  constructor(distance, duration, coords, date = new Date(), id) {
    this.distance = distance; //in km
    this.duration = duration; //in min
    this.coords = coords;
    this.date = date;
    if (id) this.id = id;
    else this.id = (Date.now() + '').slice(-10);
  }
}

class Running extends Workout {
  type = 'running';
  constructor(distance, duration, coords, cadence, date = new Date(), id) {
    super(distance, duration, coords, date, id);
    this.cadence = cadence;
    this.calcPace();
  }

  calcPace() {
    this.pace = +(this.duration / this.distance).toFixed(3);
  }
}

class Cycling extends Workout {
  type = 'cycling';
  constructor(distance, duration, coords, elevation, date = new Date(), id) {
    super(distance, duration, coords, date, id);
    this.elevation = elevation;
    this.calcSpeed();
  }

  calcSpeed() {
    //in km/h
    this.speed = +(this.distance / (this.duration / 60)).toFixed(2);
  }
}

class App {
  #map;
  #mapEvent;
  #workouts = [];
  constructor() {
    this.#getPosition();
    form.addEventListener('submit', this.#newWorkout.bind(this));
    inputType.addEventListener('change', this.#toggleElevationField);
    containerWorkouts.addEventListener(
      'click',
      this.#clickOnWorkoutEntry.bind(this)
    );
    sortInput.addEventListener('change', this.#sortAndDisplayList.bind(this));
    btnDeleteAll.addEventListener('click', this.#reset.bind(this));
    this.#loadLocalStorage();
  }

  //Map
  #getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this.#loadMap.bind(this),
        function () {
          alert('Could not get your position');
        }
      );
      return;
    }
    alert('Your browser does not support this app');
  }

  #loadMap(position) {
    const { latitude, longitude } = position.coords;
    const coords = [latitude, longitude];
    this.#map = L.map('map').setView(coords, 13);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution:
        '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(this.#map);
    this.#map.on('click', this.#showForm.bind(this));

    this.#workouts.forEach(workout => {
      this.#addMarker(workout);
    });
    this.#sortAndDisplayList();
  }

  #addMarker(workout) {
    const message = `${
      workout.type === 'running' ? '🏃‍♀️ Running' : '🚴 Cycling'
    } on ${months[workout.date.getMonth()]} ${workout.date.getDate()}`;
    L.marker(workout.coords)
      .addTo(this.#map)
      .bindPopup(
        L.popup({
          maxWidth: 250,
          minWidth: 100,
          autoClose: false,
          closeOnClick: false,
          className: `${
            workout.type === 'running' ? 'running' : 'cycling'
          }-popup`,
        })
      )
      .setPopupContent(message)
      .openPopup();
  }

  //Adding Form
  #toggleElevationField(e) {
    const currentForm = e.target.closest('.form');
    currentForm
      .querySelector('.form__input--cadence')
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
    currentForm
      .querySelector('.form__input--elevation')
      .closest('.form__row')
      .classList.toggle('form__row--hidden');
  }

  #showForm(mapE) {
    if (document.querySelector('.form--edit')) {
      alert('Submit your previous form first');
      return;
    }
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  #hideForm() {
    form.style.display = 'none';
    form.classList.add('hidden');
    inputDistance.value =
      inputDuration.value =
      inputCadence.value =
      inputElevation.value =
        '';
    setTimeout(function () {
      form.style.display = 'grid';
    }, 500);
  }

  #checkWorkoutData(workoutData) {
    const { type, distance, duration, cadence, elevation } = workoutData;
    const currentForm = document.querySelector('.form:not(.hidden)');
    document.querySelector('.wrong--input--message')?.remove();
    currentForm
      .querySelectorAll('.form__input')
      .forEach(el => el.classList.remove('wrong--input'));
    const alertMessage = function (field) {
      const inputField = currentForm.querySelector(`.form__input--${field}`);
      inputField.focus();
      inputField.classList.add('wrong--input');
      const html = `<h2 class="wrong--input--message">${
        field === 'elevation'
          ? 'Elevation gain should be a number'
          : `${
              field.slice(0, 1).toUpperCase() + field.slice(1)
            } should be a positive number`
      }<br></h2>`;
      currentForm.insertAdjacentHTML('beforebegin', html);
    };
    if (!Number.isFinite(distance) || distance <= 0) {
      alertMessage('distance');
      // alert('Distance should be a positive number!');
      return false;
    }
    if (!Number.isFinite(duration) || duration <= 0) {
      alertMessage('duration');
      // alert('Duration should be a positive number!');
      return false;
    }
    if (type === 'running' && (!Number.isFinite(cadence) || cadence <= 0)) {
      alertMessage('cadence');
      // alert('Cadence should be a positive number!');
      return false;
    }
    if (type === 'cycling' && !Number.isFinite(elevation)) {
      alertMessage('elevation');
      // alert('Elevation gain should be a number!');
      return false;
    }
    return true;
  }

  #newWorkout(e) {
    e.preventDefault();
    //Get data from form
    const { lat, lng } = this.#mapEvent.latlng;
    const workoutParams = {
      type: inputType.value,
      distance: +inputDistance.value,
      duration: +inputDuration.value,
      cadence: +inputCadence.value,
      //Usual Number conversion transforms '' into 0 instead of undefined
      elevation:
        inputElevation.value === '' ? undefined : +inputElevation.value,
      lat: lat,
      lng: lng,
    };
    this.#addWorkout(workoutParams, true);
  }

  #addWorkout(workoutParams, isNew) {
    const { type, distance, duration, cadence, elevation, lat, lng, date, id } =
      workoutParams;
    //Check if data is valid
    if (
      !this.#checkWorkoutData({ type, distance, duration, cadence, elevation })
    )
      return;
    //If the workout is running, create a Running object
    //If the workout is cycling, create a Cycling object
    let workout;
    switch (type) {
      case 'running':
        workout = new Running(
          distance,
          duration,
          [lat, lng],
          cadence,
          date,
          id
        );
        break;
      case 'cycling':
        workout = new Cycling(
          distance,
          duration,
          [lat, lng],
          elevation,
          date,
          id
        );
        break;
    }
    //Add new object to workouts array
    this.#workouts.push(workout);
    //Save data to the local storage
    this.#setLocalStorage();
    //Render the workout to the list
    //If the added element is edited and now new then this.#sortAndDisplayList will take care of adding it to list
    this.#sortAndDisplayList();
    if (isNew) {
      //Render the workout to the map as a marker
      this.#addMarker(workout);
      //Hide form and clear input fields
      this.#hideForm();
    }
  }

  //Editing Form
  #openEditForm(workoutID) {
    // const openForm = document.querySelector('.form:not(.hidden)');
    // const prevFormClosed = openForm ? this.#closeEditForm(openForm) : true;
    // if (!prevFormClosed) return;
    form.classList.add('hidden');
    if (document.querySelector('.form--edit')) {
      alert('Submit your previous form first');
      return;
    }
    const workout = this.#workouts.find(wo => wo.id === workoutID);
    const workoutElem = document.querySelector(
      `.workout[data-id="${workoutID}"]`
    );
    const html = `
    <form class="form form--edit" data-id="${workoutElem.dataset.id}">
      <div class="form__row">
        <label class="form__label">Type</label>
        <select class="form__input form__input--type">
          <option value="running" ${
            workout.type === 'running' ? 'selected' : ''
          }>Running</option>
          <option value="cycling" ${
            workout.type === 'cycling' ? 'selected' : ''
          }>Cycling</option>
        </select>
      </div>
      <div class="form__row">
        <label class="form__label">Distance</label>
        <input class="form__input form__input--distance" value="${
          workout.distance
        }" placeholder="km"/>
      </div>
      <div class="form__row">
        <label class="form__label">Duration</label>
        <input
          class="form__input form__input--duration"
          placeholder="min"
          value="${workout.duration}"
        />
      </div>
      <div class="form__row ${
        workout.type === 'running' ? '' : 'form__row--hidden'
      }">
        <label class="form__label">Cadence</label>
        <input
          class="form__input form__input--cadence"
          placeholder="step/min"
          value="${workout.cadence ?? ''}"
        />
      </div>
      <div class="form__row ${
        workout.type === 'cycling' ? '' : 'form__row--hidden'
      }">
        <label class="form__label">Elev Gain</label>
        <input
          class="form__input form__input--elevation"
          placeholder="meters"
          value="${workout.elevation ?? ''}"
        />
      </div>
      <button class="form__btn">OK</button>
    </form>`;
    workoutElem.insertAdjacentHTML('afterend', html);
    workoutElem.remove();
    const currentForm = document.querySelector('.form--edit');
    currentForm
      .querySelector('.form__input--type')
      .addEventListener('change', this.#toggleElevationField);
    currentForm.addEventListener('submit', this.#submitEditForm.bind(this));
    currentForm.querySelector('.form__input--distance').focus();
    // this.#workouts.splice(
    //   this.#workouts.findIndex(wo => wo === workout),
    //   1
    // );
  }

  #closeEditForm(currentForm) {
    const type = currentForm.querySelector('.form__input--type').value;
    const cadenceValue = currentForm.querySelector(
      '.form__input--cadence'
    ).value;
    const elevationValue = currentForm.querySelector(
      '.form__input--elevation'
    ).value;
    const workoutData = {
      type: type,
      distance: +currentForm.querySelector('.form__input--distance').value,
      duration: +currentForm.querySelector('.form__input--duration').value,
      cadence:
        type === 'running' && cadenceValue !== '' ? +cadenceValue : undefined,
      elevation:
        type === 'cycling' && elevationValue !== ''
          ? +elevationValue
          : undefined,
    };
    if (!this.#checkWorkoutData(workoutData)) return false;
    const id = currentForm.dataset.id;
    const editedWOIndex = this.#workouts.findIndex(wo => wo.id === id);
    const editedWO = this.#workouts[editedWOIndex];
    [workoutData.lat, workoutData.lng] = editedWO.coords;
    workoutData.date = editedWO.date;
    workoutData.id = editedWO.id;
    this.#workouts.splice(editedWOIndex, 1);
    this.#addWorkout(workoutData, false);
    this.#sortAndDisplayList();
    currentForm.remove();
    return true;
  }

  #submitEditForm(e) {
    e.preventDefault();
    const currentForm = e.target.closest('.form--edit');
    this.#closeEditForm(currentForm);
  }

  //Deleting Workouts
  #deleteWorkout(workout) {
    const i = this.#workouts.findIndex(wo => wo === workout);
    console.log(i);
    this.#workouts.splice(i, 1);
    console.log(this.#workouts);
    this.#setLocalStorage();
    location.reload();
  }

  //Workouts Menu
  #clickOnWorkoutEntry(e) {
    const workoutElem = e.target.closest('.workout');
    if (!workoutElem) return;
    const workout = this.#workouts.find(wo => wo.id === workoutElem.dataset.id);
    if (e.target.classList.contains('workout__btn--delete')) {
      this.#deleteWorkout(workout);
      return;
    }
    if (e.target.classList.contains('workout__btn--edit')) {
      this.#openEditForm(workout.id);
      return;
    }
    this.#shiftMapToMarker(workout);
  }

  #shiftMapToMarker(workout) {
    this.#map.setView(workout.coords);
  }

  //Displaying the workouts list
  #addWorkoutToList(workout) {
    const isRunning = workout.type === 'running';
    const html = `
      <li class="workout workout--${
        isRunning ? 'running' : 'cycling'
      }" data-id="${workout.id}">
        <h2 class="workout__title">${isRunning ? 'Running' : 'Cycling'} on ${
      months[workout.date.getMonth()]
    } ${workout.date.getDate()}
    <button class="workout__btn workout__btn--edit">📝</button>
    <button class="workout__btn workout__btn--delete">❌</button>
    </h2>
        <div class="workout__details">
          <span class="workout__icon">${isRunning ? '🏃' : '🚴‍♂️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${
            isRunning ? workout.pace : workout.speed
          }</span>
          <span class="workout__unit">${isRunning ? 'min/km' : 'km/h'}</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">${isRunning ? '🦶🏼' : '⛰'}</span>
          <span class="workout__value">${
            isRunning ? workout.cadence : workout.elevation
          }</span>
          <span class="workout__unit">${isRunning ? 'spm' : 'm'}</span>
        </div>
      </li>`;
    form.insertAdjacentHTML('afterend', html);
  }

  #sortAndDisplayList() {
    const sorter = sortInput.value;
    let compareFunction;
    switch (sorter) {
      case 'distance':
        compareFunction = (a, b) => a.distance - b.distance;
        break;
      case 'duration':
        compareFunction = (a, b) => a.duration - b.duration;
        break;
      case 'date':
        compareFunction = (a, b) => a.date - b.date;
        break;
      case 'type':
        compareFunction = (a, b) => {
          if (a.type === 'running' && b.type === 'cycling') return 1;
          if (a.type === 'cycling' && b.type === 'running') return -1;
          return a.date - b.date;
        };
    }
    this.#workouts.sort(compareFunction);
    document.querySelectorAll('.workout').forEach(woElem => woElem.remove());
    this.#workouts.forEach(wo => this.#addWorkoutToList(wo));
  }

  //Local Storage
  #setLocalStorage() {
    console.log(this.#workouts);
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  #loadLocalStorage() {
    const loadedWorkouts = JSON.parse(localStorage.getItem('workouts')) || [];
    loadedWorkouts.forEach(lWorkout => {
      // console.log(typeof workout.date);
      const date = new Date(lWorkout.date);
      let workout;
      switch (lWorkout.type) {
        case 'running':
          workout = new Running(
            lWorkout.distance,
            lWorkout.duration,
            lWorkout.coords,
            lWorkout.cadence,
            date,
            lWorkout.id
          );
          break;
        case 'cycling':
          workout = new Cycling(
            lWorkout.distance,
            lWorkout.duration,
            lWorkout.coords,
            lWorkout.elevation,
            date,
            lWorkout.id
          );
      }
      if (!workout) return;
      this.#workouts.push(workout);
    });
    console.log(this.#workouts);
  }

  #reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();

//FIXED:
//Several entries loaded from local storage point to one marker
//Fields showing undefined after being loaded from local storage
