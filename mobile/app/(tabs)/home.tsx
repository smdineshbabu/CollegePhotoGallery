import { View, Text, StyleSheet } from 'react-native';
import { Ionicons, MaterialIcons } from '@expo/vector-icons';

export default function Home() {
  return (
    <View style={styles.container}>
      <Ionicons name="school" size={80} color="#007AFF" />

      <Text style={styles.title}>College Photo Gallery</Text>

      <View style={styles.row}>
        <MaterialIcons name="photo-library" size={28} color="#333" />
        <Text style={styles.text}>View College Memories</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="people" size={28} color="#333" />
        <Text style={styles.text}>Events & Functions</Text>
      </View>

      <View style={styles.row}>
        <Ionicons name="calendar" size={28} color="#333" />
        <Text style={styles.text}>Year-wise Albums</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  title: {
    fontSize: 22,
    fontWeight: 'bold',
    marginVertical: 15,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  text: {
    fontSize: 16,
    marginLeft: 10,
  },
});
