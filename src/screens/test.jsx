// import React, { useState } from 'react';
// import { StyleSheet, View, Button, Alert } from 'react-native';
// import * as Location from 'expo-location';
// import * as TaskManager from 'expo-task-manager';
//
// const LOCATION_TASK_NAME = 'BACKGROUND_LOCATION_TASK';
//
// // Реєструємо фонове завдання для обробки геолокації
// TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
//     if (error) {
//         console.error('Помилка у фоні:', error);
//         return;
//     }
//     if (data) {
//         const { locations } = data;
//         console.log('Оновлення геолокації:', locations);
//     }
// });
//
// export default function Test() {
//     const [tracking, setTracking] = useState(false);
//
//     const startBackgroundLocation = async () => {
//         // Запит дозволів для роботи у передньому та фоновому режимах
//         let { status } = await Location.requestForegroundPermissionsAsync();
//         if (status !== 'granted') {
//             Alert.alert('Помилка', 'Дозвіл на геолокацію не надано');
//             return;
//         }
//         let { status: bgStatus } = await Location.requestBackgroundPermissionsAsync();
//         if (bgStatus !== 'granted') {
//             Alert.alert('Помилка', 'Дозвіл на фонову геолокацію не надано');
//             return;
//         }
//
//         // Запуск фонового відстеження геолокації
//         await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
//             accuracy: Location.Accuracy.High,
//             timeInterval: 10000, // оновлення кожні 10 секунд
//             distanceInterval: 0,
//         });
//
//         setTracking(true);
//         console.log('Фонове відстеження геолокації запущено');
//     };
//
//     const stopBackgroundLocation = async () => {
//         // Перевіряємо, чи запущено фонове відстеження, та зупиняємо його
//         const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
//         if (isRunning) {
//             await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
//             setTracking(false);
//             console.log('Фонове відстеження геолокації вимкнено');
//         } else {
//             Alert.alert('Інформація', 'Фонове відстеження не активне');
//         }
//     };
//
//     return (
//         <View style={styles.container}>
//             {!tracking ? (
//                 <Button title="Запустити геолокацію" onPress={startBackgroundLocation} />
//             ) : (
//                 <Button title="Вимкнути фонову задачу" onPress={stopBackgroundLocation} />
//             )}
//         </View>
//     );
// }
//
// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         justifyContent: 'center',
//         alignItems: 'center',
//     },
// });
