function convertMetersToMiles(meters) {
    const metersInMile = 1609.34;
    const miles = meters / metersInMile;

    return Math.round(miles * 10) / 10;
}

export {convertMetersToMiles}