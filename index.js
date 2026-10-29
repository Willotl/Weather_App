const weatherForm = document.getElementById("weather-form");
const weatherButton = document.getElementById("weather-button");

const cityInput = document.getElementById("city");
const provinceInput = document.getElementById("province");
const countryInput = document.getElementById("country");

const errorMessage = document.getElementById("error-message");
const statusMessage = document.getElementById("status-message");
const weatherResults = document.getElementById("weather-results");

const locationName = document.getElementById("location-name");
const temperatureElement = document.getElementById("temperature");
const feelsLikeElement = document.getElementById("feels-like");
const windSpeedElement = document.getElementById("wind-speed");
const humidityElement = document.getElementById("humidity");

// Normalize text to compare names regardless of case,
// extra spaces, or common accent differences.
function normalizeText(value) {
    return value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .trim()
        .toLocaleLowerCase();
}

// Display an error message to the user.
function showError(message) {
    errorMessage.textContent = message;
    errorMessage.hidden = false;
}

// Clear previous errors.
function clearError() {
    errorMessage.textContent = "";
    errorMessage.hidden = true;
}

// Retrieve coordinates from the Open-Meteo Geocoding API.
async function getCoordinates(city, province, country) {
    const encodedCity = encodeURIComponent(city);

    const geocodingURL =
        `https://geocoding-api.open-meteo.com/v1/search` +
        `?name=${encodedCity}&count=100&language=en&format=json`;

    const response = await fetch(geocodingURL);

    if (!response.ok) {
        throw new Error(
            "Unable to search for the location. Please try again."
        );
    }

    const data = await response.json();

    if (!Array.isArray(data.results) || data.results.length === 0) {
        throw new Error(
            "Location not found. Check the city, province/state, and country."
        );
    }

    // Compare city, province/state, and country.
    const matchingLocation = data.results.find((location) => {
        const cityMatches =
            normalizeText(location.name) === normalizeText(city);

        const provinceMatches =
            normalizeText(location.admin1 || "") === normalizeText(province);

        const countryMatches =
            normalizeText(location.country || "") === normalizeText(country);

        return cityMatches && provinceMatches && countryMatches;
    });

    if (!matchingLocation) {
        throw new Error(
            "No exact location match was found. Please verify the spelling " +
            "of your city, province/state, and country."
        );
    }

    if (
        typeof matchingLocation.latitude !== "number" ||
        typeof matchingLocation.longitude !== "number"
    ) {
        throw new Error(
            "Coordinates are unavailable for this location."
        );
    }

    return {
        latitude: matchingLocation.latitude,
        longitude: matchingLocation.longitude,
        name: matchingLocation.name,
        province: matchingLocation.admin1 || province,
        country: matchingLocation.country || country
    };
}

// Retrieve current weather using the returned coordinates.
async function getWeather(latitude, longitude) {
    const weatherURL =
        `https://api.open-meteo.com/v1/forecast` +
        `?latitude=${latitude}` +
        `&longitude=${longitude}` +
        `&current=temperature_2m,apparent_temperature,wind_speed_10m,relative_humidity_2m` +
        `&temperature_unit=celsius` +
        `&wind_speed_unit=kmh` +
        `&timezone=auto`;

    const response = await fetch(weatherURL);

    if (!response.ok) {
        throw new Error(
            "Unable to retrieve weather data. Please try again later."
        );
    }

    const data = await response.json();

    if (!data.current) {
        throw new Error(
            "Current weather information is unavailable for this location."
        );
    }

    const current = data.current;

    const requiredProperties = [
        "temperature_2m",
        "apparent_temperature",
        "wind_speed_10m",
        "relative_humidity_2m"
    ];

    const hasAllProperties = requiredProperties.every(
        (property) =>
            typeof current[property] === "number" &&
            Number.isFinite(current[property])
    );

    if (!hasAllProperties) {
        throw new Error(
            "Some weather measurements are currently unavailable."
        );
    }

    return current;
}

// Display weather data on the webpage.
function displayWeather(location, weather) {
    locationName.textContent =
        `${location.name}, ${location.province}, ${location.country}`;

    temperatureElement.textContent =
        `${weather.temperature_2m} °C`;

    feelsLikeElement.textContent =
        `${weather.apparent_temperature} °C`;

    windSpeedElement.textContent =
        `${weather.wind_speed_10m} km/h`;

    humidityElement.textContent =
        `${weather.relative_humidity_2m}%`;

    weatherResults.hidden = false;
}

// Handle form submission without reloading the page.
weatherForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    clearError();
    statusMessage.textContent = "";
    weatherResults.hidden = true;

    const city = cityInput.value.trim();
    const province = provinceInput.value.trim();
    const country = countryInput.value.trim();

    // Validate all three inputs.
    if (!city || !province || !country) {
        showError(
            "Please fill in the city, province/state, and country."
        );
        return;
    }

    weatherButton.disabled = true;
    weatherButton.textContent = "Loading...";
    statusMessage.textContent = "Retrieving current weather...";

    try {
        // First API request: find the geographical coordinates.
        const location = await getCoordinates(city, province, country);

        // Second API request: retrieve weather using those coordinates.
        const weather = await getWeather(
            location.latitude,
            location.longitude
        );

        // Update the interface with the results.
        displayWeather(location, weather);
        statusMessage.textContent = "Weather updated successfully.";
    } catch (error) {
        showError(
            error instanceof Error
                ? error.message
                : "An unexpected error occurred. Please try again."
        );

        statusMessage.textContent = "";
    } finally {
        // Restore the button even if a request fails.
        weatherButton.disabled = false;
        weatherButton.textContent = "Get Weather";
    }
});
