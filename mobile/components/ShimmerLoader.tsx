import React from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import Animated, {
    useAnimatedStyle,
    useSharedValue,
    withRepeat,
    withTiming,
    interpolate
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';

const { width: SCREEN_WIDTH } = Dimensions.get('window');

interface ShimmerLoaderProps {
    width: number | string;
    height: number | string;
    borderRadius?: number;
    style?: any;
}

const ShimmerLoader: React.FC<ShimmerLoaderProps> = ({
    width: w,
    height: h,
    borderRadius = 15,
    style
}) => {
    const shimmerProgress = useSharedValue(0);

    React.useEffect(() => {
        shimmerProgress.value = withRepeat(
            withTiming(1, { duration: 2000 }),
            -1, // Loop forever
            false // Do not reverse
        );
    }, []);

    const animatedStyle = useAnimatedStyle(() => {
        const translateX = interpolate(
            shimmerProgress.value,
            [0, 1],
            [-SCREEN_WIDTH * 0.5, SCREEN_WIDTH * 0.5]
        );
        return {
            transform: [{ translateX }],
        };
    });

    return (
        <View style={[styles.container, { width: w, height: h, borderRadius }, style]}>
            <Animated.View style={[StyleSheet.absoluteFill, animatedStyle]}>
                <LinearGradient
                    colors={['rgba(240,240,240,0)', 'rgba(255,255,255,0.6)', 'rgba(240,240,240,0)']}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={StyleSheet.absoluteFill}
                />
            </Animated.View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        backgroundColor: '#E8E8E8',
        overflow: 'hidden',
    },
});

export default ShimmerLoader;
