function convertMetersToMiles(meters) {
    const metersInMile = 1609.34;
    const miles = meters / metersInMile;

    // Округляємо до 15.7 миль
    return Math.round(miles * 10) / 10;
}

export {convertMetersToMiles}