import React from 'react';
import { StyleSheet, View, Text, TouchableOpacity, SafeAreaView, FlatList } from 'react-native';
import BottomNavigationMenu from '../components/BottomNavigationMenu';
import { Colors, Fonts } from '../utils/tokens';
import NotificationsScreen from "./NotificationsScreen";

const actions = [
    { id: '1', name: 'independent unloading',disabled:true },
    { id: '2', name: 'Reload using the dispatcher',disabled:true },
    { id: '3', name: 'Get a list of packages from another driver',disabled:true },
    { id: '4', name: 'Emergency',disabled:true },
    { id: '5', name: 'Notifications',screen:"NotificationsScreen",disabled:false },
];

const ActionItem = ({ action,navigation }) => (
    <View style={styles.actionItemContainer}>
        <Text style={styles.actionName}>{action.name}</Text>
        <TouchableOpacity onPress={()=>{
            if(action?.screen){
                navigation.navigate(action.screen)
            }
        }} style={action.disabled?styles.selectButtonDisabled:styles.selectButton} disabled={action.disabled}>
            <Text style={styles.selectButtonText}>SELECT</Text>
        </TouchableOpacity>
    </View>
);

const ActionListsPage = ({ navigation }) => {
    return (
        <View style={{flex:1}}>
            <View style={styles.container}>
                <Text style={styles.title}>Action lists</Text>
                <FlatList
                    data={actions}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => <ActionItem navigation={navigation} action={item} />}
                    contentContainerStyle={styles.listContainer}
                />
            </View>
            <BottomNavigationMenu navigation={navigation} activeTab="Home" />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: Colors.white,
        padding: 20,
    },
    title: {
        fontSize: Fonts.f36,
        color: Colors.mainBlue,
        fontWeight: 'bold',
        textAlign: 'left',
        marginBottom: 20,
    },
    listContainer: {
        flexGrow: 1,

    },
    actionItemContainer: {
        backgroundColor: Colors.mainBlue + '20',
        borderRadius: 8,
        padding: 15,
        marginBottom: 10,
        flexDirection: 'column',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
    },
    actionName: {
        fontSize: Fonts.f20,
        color: Colors.blackText,
        fontWeight: 'bold',
        marginBottom:24
    },
    selectButtonDisabled: {
        backgroundColor: Colors.mainBlue + '50',
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 15,
    },
    selectButton: {
        backgroundColor: Colors.mainBlue ,
        borderRadius: 8,
        paddingVertical: 5,
        paddingHorizontal: 15,
    },
    selectButtonText: {
        fontSize: Fonts.f14,
        color: Colors.white,
        fontWeight: 'bold',
    },
});

export default ActionListsPage;
