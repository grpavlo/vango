// import React, {useEffect, useState} from 'react';
// import {StyleSheet, View, Text, TouchableOpacity} from 'react-native';
// import {Colors, Fonts} from '../utils/tokens';
// import UniversalModal from "../components/UniversalModal";
// import * as SecureStore from "expo-secure-store";
// import {serverUrlApi} from "../const/api";
//
// const ConfirmUploadPage = ({navigation, route}) => {
//     const {
//         idRoute,
//         idCheckpoint
//     } = route.params;
//
//     const [packageCount, setPackageCount] = useState(0);
//     const [modalVisible, setModalVisible] = useState(false);
//     const [dialogVisible, setDialogVisible] = useState(false);
//     const [serverPackageCount, setServerPackageCount] = useState(0);
//     const [errorMessage, setErrorMessage] = useState("");
//
//     useEffect(() => {
//         (async ()=>{
//             try {
//                 const accessToken = await SecureStore.getItemAsync('accessToken');
//                 if(!accessToken){
//                     setErrorMessage('Authentication token is missing. Please log in again.');
//                     return;
//                 }
//                 if(!idRoute){
//                     setErrorMessage('No route id found.');
//                     return;
//                 }
//
//                 console.log(idRoute)
//
//                 const resp = await fetch(serverUrlApi+`routes/${idRoute}/packages/count`, {
//                     method:'GET',
//                     headers:{
//                         'accept': 'application/json',
//                         'Authorization': `Bearer ${accessToken}`
//                     }
//                 });
//                 if(resp.status===200){
//                     const num = await resp.json();
//                     setServerPackageCount(num);
//                 } else {
//                     setErrorMessage('Failed to get package count.');
//                 }
//             }catch(e){
//                 setErrorMessage(e.message);
//             }
//         })();
//     },[]);
//
//     const handleIncrement = () => {
//         setPackageCount((prevCount) => prevCount + 1);
//     };
//
//     const handleDecrement = () => {
//         setPackageCount((prevCount) => (prevCount > 0 ? prevCount - 1 : 0));
//     };
//
//     const handleConfirmOk = async () => {
//         setModalVisible(false);
//         try {
//             const accessToken = await SecureStore.getItemAsync('accessToken');
//             if(!accessToken){
//                 return;
//             }
//             // PATCH visits/{idCheckpoint}/upload with user packageCount
//             const resp = await fetch(serverUrlApi+`visits/${idCheckpoint}/upload`, {
//                 method:'PATCH',
//                 headers:{
//                     'accept': '*/*',
//                     'Authorization': `Bearer ${accessToken}`,
//                     'Content-Type': 'application/json'
//                 },
//                 body: JSON.stringify(packageCount)
//             });
//             if(resp.status===200){
//                 navigation.navigate("RoutesPage",{idRoute});
//                 // if(last){
//                 //     const finishResp = await fetch(serverUrlApi+`routes/${idRoute}/finish`,{
//                 //         method:'PATCH',
//                 //         headers:{
//                 //             'accept':'application/json',
//                 //             'Authorization': `Bearer ${accessToken}`
//                 //         }
//                 //     });
//                 //     if(finishResp.status===200){
//                 //         navigation.navigate("RoutesPage",{idRoute});
//                 //         await SecureStore.deleteItemAsync('idRoute');
//                 //
//                 //     } else {
//                 //         setErrorMessage('Failed to finish the route.');
//                 //     }
//                 // } else {
//                 //     navigation.navigate("RoutesPage",{idRoute});
//                 // }
//             } else {
//                 setErrorMessage('Failed to upload packages.');
//             }
//         }catch(e){
//             setErrorMessage(e.message);
//         }
//     };
//
//     const handleConfirm = () => {
//         if(serverPackageCount === packageCount){
//             handleConfirmOk();
//         } else {
//             setDialogVisible(true);
//         }
//     };
//
//     const handleDialogConfirm = () => {
//         setDialogVisible(false);
//         handleConfirmOk();
//     };
//     const handleDialogCancel = () => {
//         setDialogVisible(false);
//     };
//
//     return (
//         <View style={styles.container}>
//             <View style={styles.header}>
//                 <TouchableOpacity onPress={() => navigation.goBack()}>
//                     <Text style={styles.backText}>Back</Text>
//                 </TouchableOpacity>
//             </View>
//
//             <View style={styles.content}>
//                 {errorMessage ? (
//                     <Text style={[styles.title,{color:Colors.mainRed}]}>{errorMessage}</Text>
//                 ):(
//                     <Text style={styles.title}>Ready to transfer {serverPackageCount} packages</Text>
//                 )}
//
//                 <View style={{flexDirection:"row"}}>
//                     <View style={styles.counterContainerSpam}>
//                         <View style={styles.packageCount}>
//                             <Text style={styles.spamText}>PACKAGES</Text>
//                             <Text style={styles.spamTextMini}>BY QUANTITY</Text>
//                         </View>
//                     </View>
//                     <View style={styles.counterContainer}>
//                         <TouchableOpacity onPress={handleDecrement} style={styles.counterButton}>
//                             <Text style={styles.counterText}>-</Text>
//                         </TouchableOpacity>
//
//                         <View style={styles.packageCount}>
//                             <Text style={styles.countText}>{packageCount}</Text>
//                         </View>
//
//                         <TouchableOpacity onPress={handleIncrement} style={styles.counterButton}>
//                             <Text style={styles.counterText}>+</Text>
//                         </TouchableOpacity>
//                     </View>
//                 </View>
//
//                 <TouchableOpacity style={styles.confirmButton} onPress={()=>setModalVisible(true)}>
//                     <Text style={styles.confirmText}>CONFIRM UPLOADING</Text>
//                 </TouchableOpacity>
//             </View>
//
//             <UniversalModal
//                 visible={modalVisible}
//                 title="Confirm?"
//                 description="Are you sure you want to upload?"
//                 confirmText="Confirm"
//                 cancelText="Cancel"
//                 onConfirm={handleConfirm}
//                 onCancel={()=>setModalVisible(false)}
//             />
//
//             <UniversalModal
//                 visible={dialogVisible}
//                 title="The number of packages does not match. Are you sure?"
//                 description=""
//                 confirmText="Yes"
//                 cancelText="No"
//                 onConfirm={handleDialogConfirm}
//                 onCancel={handleDialogCancel}
//             />
//         </View>
//     );
// };
//
// const styles = StyleSheet.create({
//     container: {
//         flex: 1,
//         backgroundColor: Colors.white,
//         paddingHorizontal: 20,
//     },
//     header: {
//         marginTop: 20,
//         marginBottom: 20,
//     },
//     backText: {
//         fontSize: Fonts.f16,
//         color: Colors.mainBlue,
//     },
//     content: {
//         alignItems: 'center',
//         flex: 1,
//         justifyContent: "space-between",
//         padding: 70
//     },
//     title: {
//         fontSize: Fonts.f16,
//         color: Colors.blackText,
//         marginBottom: 20,
//         textAlign: 'center',
//     },
//     spamText:{
//         fontSize: Fonts.f16,
//         color: Colors.blackText+'80',
//         textAlign: 'center',
//         fontWeight: 'bold',
//     },
//     spamTextMini:{
//         fontSize: Fonts.f12,
//         color: Colors.blackText+'80',
//         textAlign: 'center',
//         fontWeight: 'bold',
//     },
//     counterContainer: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         marginBottom: 30,
//         backgroundColor: Colors.lightGray,
//         borderRadius: 10,
//         padding: 10,
//     },
//     counterContainerSpam: {
//         flexDirection: 'row',
//         alignItems: 'center',
//         marginBottom: 30,
//         backgroundColor: Colors.lightGray,
//         borderRadius: 10,
//         padding: 10,
//         marginRight:5
//     },
//     counterButton: {
//         backgroundColor: Colors.white,
//         borderRadius: 5,
//         padding: 15,
//         marginHorizontal: 5,
//     },
//     counterText: {
//         fontSize: Fonts.f20,
//         color: Colors.mainBlue,
//     },
//     packageCount: {
//         paddingHorizontal: 20,
//         justifyContent: 'center',
//     },
//     countText: {
//         fontSize: Fonts.f20,
//         color: Colors.blackText,
//         fontWeight: 'bold',
//     },
//     confirmButton: {
//         backgroundColor: Colors.mainBlue,
//         paddingVertical: 15,
//         paddingHorizontal: 20,
//         borderRadius: 8,
//     },
//     confirmText: {
//         color: Colors.white,
//         fontSize: Fonts.f14,
//         fontWeight: 'bold',
//     },
// });
//
// export default ConfirmUploadPage;

import React, {useEffect, useState} from 'react';
import {ActivityIndicator, Alert, FlatList, StyleSheet, Text, TouchableOpacity, View} from 'react-native';
import * as SecureStore from 'expo-secure-store';
import {Fontisto, Ionicons} from '@expo/vector-icons';

// Імпорт ваших констант
import {serverUrlApi} from '../const/api';
import {Colors, Fonts} from '../utils/tokens';

export default function ConfirmUploadPage({route, navigation}) {
    const {idRoute, idCheckpoint} = route.params;
    const [routes, setRoutes] = useState([]);
    const [totalPackages, setTotalPackages] = useState(0);
    const [selectedSamples, setSelectedSamples] = useState([]); // Зберігаємо ID вибраних зразків
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        fetchRoutesWithSamples();
    }, []);

    const fetchRoutesWithSamples = async () => {
        setLoading(true);
        setError(null);

        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            const idRouteStorage = await SecureStore.getItemAsync('idRoute');

            if (!accessToken) {
                throw new Error('Немає accessToken у SecureStore');
            }

            // Формуємо URL з параметром routeId
            const url = `${serverUrlApi}routes/me/samples?routeId=${idRoute || idRouteStorage || ''}`;

            const response = await fetch(url, {
                method: 'GET',
                headers: {
                    accept: 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            if (!response.ok) {
                const message = `Помилка при завантаженні: ${response.status}`;
                throw new Error(message);
            }

            const data = await response.json();

            const filtered = data.filter((route) => route.samples && route.samples.length > 0);

            const total = filtered.reduce((sum, route) => sum + route.samples.length, 0);

            setRoutes(filtered);
            setTotalPackages(total);
            setSelectedSamples([]);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const toggleSample = (sampleId) => {
        setSelectedSamples((prevSelected) => {
            if (prevSelected.includes(sampleId)) {
                return prevSelected.filter((id) => id !== sampleId);
            } else {
                return [...prevSelected, sampleId];
            }
        });
    };

    const toggleSelectAll = () => {
        const allSampleIds = routes.flatMap((routeItem) =>
            routeItem.samples.map((s) => s.id)
        );

        if (allSampleIds.length === selectedSamples.length) {
            setSelectedSamples([]);
        } else {
            setSelectedSamples(allSampleIds);
        }
    };

    const isAllSelected = () => {
        if (routes.length === 0) return false;
        const allSampleIds = routes.flatMap((routeItem) =>
            routeItem.samples.map((s) => s.id)
        );
        return allSampleIds.length > 0 && allSampleIds.length === selectedSamples.length;
    };

    const confirmSelection = async () => {
        if (selectedSamples.length === 0) {
            Alert.alert('WARNING', 'Choose at least one sample!');
            return;
        }

        setLoading(true);

        try {
            const accessToken = await SecureStore.getItemAsync('accessToken');
            if (!accessToken) {
                throw new Error(' accessToken  SecureStore');
            }



            const patchUrl = `${serverUrlApi}visits/${idCheckpoint}/samples`;
            const response = await fetch(patchUrl, {
                method: 'PATCH',
                headers: {
                    Accept: '*/*',
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${accessToken}`,
                },
                body: JSON.stringify(selectedSamples),
            });


            if (!response.ok) {
                const message = `Error while sending: ${response.status}`;
                throw new Error(message);
            }

            // Якщо все добре, переходимо на інший екран
            navigation.navigate('RouteCheckpointsPageSelect',{idRoute});
            // navigation.navigate("RoutesPage",{idRoute});
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleSamplePress = (routeItem, sample) => {
        navigation.navigate('SampleDetailScreen', {
            sample,
            routeName: routeItem.name,
            routeDate: routeItem.date
        });
    };

    const renderRouteItem = ({item}) => {
        return (
            <View style={styles.routeContainer}>
                <Text style={styles.routeDate}>{item.date}</Text>
                <Text style={styles.routeName}>
                    {item.name} ({item.samples.length} pcs)
                </Text>

                {item.samples.map((sample) => {
                    const isSelected = selectedSamples.includes(sample.id);
                    return (

                        <TouchableOpacity
                            onPress={() =>handleSamplePress(item, sample)}

                            key={sample.id}  style={styles.sampleItem}>
                            <View style={{flex: 1}}>
                                <Text style={styles.sampleTitle}>
                                    {sample.cargoName} / {sample.checkpointName}
                                </Text>
                                <Text style={styles.sampleAddress}>
                                    {sample.address}, {sample.city}, {sample.state} {sample.zipCode}
                                </Text>
                            </View>
                            <TouchableOpacity
                                key={sample.id}

                                onPress={() => toggleSample(sample.id)}
                            >
                                <Fontisto
                                    name={isSelected ? 'checkbox-active' : 'checkbox-passive'}
                                    size={20}
                                    color={Colors.mainBlue}
                                    style={{marginLeft: 8}}
                                />

                            </TouchableOpacity>
                        </TouchableOpacity>

                    );
                })}
            </View>
        );
    };

    if (loading) {
        return (
            <View style={styles.centered}>
                <ActivityIndicator size="large" color="#000"/>
            </View>
        );
    }

    if (error) {
        return (
            <View style={styles.centered}>
                <Text style={{color: 'red', marginBottom: 10}}>Error: {error}</Text>
                <TouchableOpacity onPress={fetchRoutesWithSamples} style={styles.retryButton}>
                    <Text style={styles.retryText}>Try again</Text>
                </TouchableOpacity>
            </View>
        );
    }

    const selectedCount = selectedSamples.length;

    return (
        <View style={{flex: 1, backgroundColor: '#fff'}}>
            {/* Заголовок і "Select all" */}
            <View style={styles.topContainer}>
                <TouchableOpacity style={styles.backButton} onPress={() => navigation.goBack()}>
                    <Ionicons name="chevron-back" size={24} color={Colors.blackText}/>
                    <Text style={styles.backText}>Back</Text>
                </TouchableOpacity>

                <Text style={styles.headerText}>
                    Ready to transfer{' '}
                    <Text style={styles.headerCount}>{totalPackages}</Text> packages
                </Text>

                <TouchableOpacity style={styles.selectAllContainer} onPress={toggleSelectAll}>
                    <Text style={styles.selectAllText}>select all</Text>
                    <Fontisto
                        name={isAllSelected() ? 'checkbox-active' : 'checkbox-passive'}
                        size={20}
                        color={Colors.mainBlue}
                        style={{marginLeft: 8}}
                    />
                </TouchableOpacity>
            </View>

            <FlatList
                data={routes}
                keyExtractor={(item) => item.id}
                renderItem={renderRouteItem}
                contentContainerStyle={{paddingBottom: 100}}
                style={styles.list}
            />

            <View style={styles.footerContainer}>
                <TouchableOpacity
                    style={[
                        styles.confirmButton,
                        selectedCount === 0 && {opacity: 0.5},
                    ]}
                    onPress={confirmSelection}
                    disabled={selectedCount === 0}
                >
                    <Text style={styles.confirmButtonText}>
                        CONFIRM UPLOADING ROUTE END
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

// СТИЛІ
const styles = StyleSheet.create({
    topContainer: {
        paddingTop: 50,
        paddingHorizontal: 16,
        backgroundColor: '#fff',
    },
    backButton: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    backText: {
        marginLeft: 4,
        color: Colors.blackText,
    },
    headerText: {
        fontSize: Fonts.f23,
        fontWeight: '600',
        marginTop: 16,
        color: Colors.mainBlue,
    },
    headerCount: {
        color: Colors.mainYellow,
    },
    selectAllContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginTop: 8,
        marginBottom: 16,
    },
    selectAllText: {
        fontSize: Fonts.f14,
        color: Colors.blackText,
    },
    list: {
        paddingHorizontal: 16,
    },
    routeContainer: {
        marginBottom: 24,
        padding: 12,
        borderWidth: 1,
        borderColor: '#ccc',
        borderRadius: 8,
    },
    routeDate: {
        fontSize: 14,
        fontWeight: '600',
        color: '#444',
        marginBottom: 4,
    },
    routeName: {
        fontSize: 16,
        fontWeight: '400',
        marginBottom: 8,
    },
    sampleItem: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: Colors.mainBlue + '10',
        padding: 8,
        borderRadius: 6,
        marginBottom: 6,
    },
    sampleTitle: {
        fontSize: Fonts.f12,
        fontWeight: '400',
    },
    sampleAddress: {
        color: '#666',
        marginTop: 2,
        fontSize: Fonts.f12,
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    retryButton: {
        marginTop: 10,
        padding: 10,
        backgroundColor: Colors.mainBlue,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
    },
    footerContainer: {
        position: 'absolute',
        bottom: 0,
        width: '100%',
        padding: 16,
        backgroundColor: '#fff',
        borderTopWidth: 1,
        borderTopColor: '#ddd',
    },
    confirmButton: {
        backgroundColor: Colors.mainBlue,
        paddingVertical: 16,
        borderRadius: 8,
        alignItems: 'center',
    },
    confirmButtonText: {
        color: '#fff',
        fontSize: Fonts.f16,
        fontWeight: '600',
    },
});

