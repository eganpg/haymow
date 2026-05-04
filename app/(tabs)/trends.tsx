import { StyleSheet, Text, View } from 'react-native';
import { Colors } from '@/constants/Colors';

export default function TrendsScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.placeholder}>Trends — coming soon</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.linen,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeholder: {
    fontSize: 16,
    color: Colors.charcoal,
  },
});
