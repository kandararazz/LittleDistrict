import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

interface DevBadgeProps {
  isDeveloper?: boolean;
}

export const DevBadge: React.FC<DevBadgeProps> = ({ isDeveloper }) => {
  if (!isDeveloper) return null;

  return (
    <View style={styles.badgeContainer}>
      <Text style={styles.badgeText}>⚡ DEV</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  badgeContainer: {
    backgroundColor: '#7C3AED',
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 12,
    alignSelf: 'center',
    marginLeft: 6,
    shadowColor: '#7C3AED',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 3,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: 'bold',
    letterSpacing: 0.5,
  },
});

export default DevBadge;
