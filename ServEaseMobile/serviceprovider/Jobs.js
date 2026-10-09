import React, { useState, useCallback } from 'react';
import { View, Image, Text, TextInput, TouchableOpacity, ScrollView, StyleSheet, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from '@react-navigation/native';
import { getProviderJobs } from '../api/providerWork_api';
import { formatPeso, formatShortDate } from '../utils/provider_formatters';

const FILTER_OPTIONS = ['All', 'Active', 'Pending', 'Done'];

const Jobs = ({ navigation }) => {
    // Jobs come from GET /provider/jobs (see api/providerWorkApi.js for the shape).
    const [jobs, setJobs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [loadFailed, setLoadFailed] = useState(false);
    const [selectedFilter, setSelectedFilter] = useState('All');
    const [searchQuery, setSearchQuery] = useState('');

    const loadJobs = useCallback(async () => {
        try {
            const data = await getProviderJobs();
            setJobs(data?.jobs ?? []);
            setLoadFailed(false);
        } catch (error) {
            // Keep the last known jobs. A 401 is already handled by api/client.
            setLoadFailed(true);
        }
    }, []);

    // Load on mount and whenever the screen regains focus, so a status update
    // pushed from JobUpdateStatus shows up when the provider comes back.
    useFocusEffect(
        useCallback(() => {
            loadJobs().finally(() => setLoading(false));
        }, [loadJobs]),
    );

    const handleRefresh = async () => {
        setRefreshing(true);
        await loadJobs();
        setRefreshing(false);
    };

    const handleFilterPress = (filter) => {
        setSelectedFilter(filter);
    };

    const handleUpdateStatus = (jobId) => {
        navigation.navigate('JobUpdateStatus', { jobId });
    };

    const handleNotifyAdditionalParts = (jobId) => {
        navigation.navigate('JobAdditionalParts', { jobId });
    };


    const statusFiltered = selectedFilter === 'All'
        ? jobs
        : jobs.filter((job) => job.status === selectedFilter);

    const query = searchQuery.trim().toLowerCase();
    const visibleJobs = query
        ? statusFiltered.filter((job) =>
              String(job.requestNumber || '').toLowerCase().includes(query) ||
              String(job.customerName || '').toLowerCase().includes(query) ||
              String(job.currentStepLabel || '').toLowerCase().includes(query)
          )
        : statusFiltered;

    return (
        <SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />}
            >
                <Text style={styles.headerTitle}>Active Jobs</Text>

                <TextInput
                    style={styles.searchInput}
                    placeholder="Search job and details..."
                    placeholderTextColor="#999999"
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />

                <View style={styles.filterRow}>
                    {FILTER_OPTIONS.map((filter) => {
                        const isActive = filter === selectedFilter;
                        return (
                            <TouchableOpacity
                                key={filter}
                                style={isActive ? styles.filterPillActive : styles.filterPill}
                                onPress={() => handleFilterPress(filter)}
                            >
                                <Text style={isActive ? styles.filterTextActive : styles.filterText}>
                                    {filter}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </View>

                {loadFailed && (
                    <TouchableOpacity style={styles.errorBanner} onPress={loadJobs}>
                        <Text style={styles.errorBannerText}>Couldn't load your jobs. Tap to retry.</Text>
                    </TouchableOpacity>
                )}

                {loading ? (
                    <ActivityIndicator style={styles.loader} color="#0255AF" />
                ) : visibleJobs.length > 0 ? (
                    visibleJobs.map((job) => {
                        const stepCount = job.stages?.length || 0;
                        return (
                            <View key={job.id} style={styles.jobCard}>
                                <View style={styles.cardTopRow}>
                                    <Text style={styles.requestNumber}>Request #{job.requestNumber}</Text>
                                    {job.statusLabel ? (
                                        <View style={styles.statusBadge}>
                                            <Text style={styles.statusBadgeText}>{job.statusLabel}</Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text style={styles.jobSubtitle}>
                                    {job.customerName}{job.createdAt ? ` | ${formatShortDate(job.createdAt)}` : ''}
                                </Text>

                                {job.aiSuggestion ? (
                                    <View style={styles.aiBanner}>
                                        <Image source={require('../assets/icon_lightning.png')} style={styles.aiIcon} />
                                        <Text style={styles.aiBannerText}>{job.aiSuggestion}</Text>
                                    </View>
                                ) : null}

                                <View style={styles.divider} />

                                {stepCount > 0 && (
                                    <View style={styles.stepRow}>
                                        {job.stages.map((stage, index) => {
                                            let segmentStyle = styles.stepSegmentUpcoming;
                                            if (index < job.currentStepIndex) segmentStyle = styles.stepSegmentDone;
                                            else if (index === job.currentStepIndex) segmentStyle = styles.stepSegmentCurrent;
                                            return (
                                                <View
                                                    key={`${stage}-${index}`}
                                                    style={[
                                                        styles.stepSegmentBase,
                                                        segmentStyle,
                                                        index === stepCount - 1 && styles.stepSegmentLast,
                                                    ]}
                                                />
                                            );
                                        })}
                                    </View>
                                )}
                                {job.currentStepLabel ? (
                                    <Text style={styles.currentStepLabel}>Current Step: {job.currentStepLabel}</Text>
                                ) : null}
                                {Number(job.progressPaymentPaid) > 0 ? (
                                    <Text style={styles.progressPaymentText}>
                                        Progress Payment {formatPeso(job.progressPaymentPaid)} already paid by customer
                                    </Text>
                                ) : null}

                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.actionButton, styles.actionButtonSpacing]}
                                        onPress={() => handleUpdateStatus(job.id)}
                                    >
                                        <Text style={styles.actionButtonText}>Update Status</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={styles.actionButton}
                                        onPress={() => handleNotifyAdditionalParts(job.id)}
                                    >
                                        <Text style={styles.actionButtonText}>Notify Additional Parts</Text>
                                    </TouchableOpacity>
                                </View>
                            </View>
                        );
                    })
                ) : (
                    !loadFailed && <Text style={styles.emptyStateText}>No jobs found</Text>
                )}
            </ScrollView>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    scrollContent: {
        paddingHorizontal: 24,
        paddingTop: 16,
        paddingBottom: 24,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: '800',
        color: '#1B2A8C',
        marginBottom: 16,
    },
    searchInput: {
        backgroundColor: '#EFEFEF',
        borderRadius: 10,
        paddingHorizontal: 16,
        paddingVertical: 12,
        fontSize: 14,
        color: '#333333',
        marginBottom: 16,
    },
    filterRow: {
        flexDirection: 'row',
        marginBottom: 20,
    },
    filterPill: {
        borderWidth: 1,
        borderColor: '#D5D5D5',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#FFFFFF',
    },
    filterPillActive: {
        borderWidth: 1,
        borderColor: '#0255AF',
        borderRadius: 20,
        paddingVertical: 8,
        paddingHorizontal: 16,
        marginRight: 8,
        backgroundColor: '#0255AF',
    },
    filterText: {
        fontSize: 13,
        fontWeight: '600',
        color: '#555555',
    },
    filterTextActive: {
        fontSize: 13,
        fontWeight: '600',
        color: '#FFFFFF',
    },
    jobCard: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#FFFFFF',
        padding: 16,
        marginBottom: 16,
    },
    cardTopRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    requestNumber: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111111',
    },
    statusBadge: {
        backgroundColor: '#2FAE60',
        borderRadius: 12,
        paddingVertical: 4,
        paddingHorizontal: 10,
    },
    statusBadgeText: {
        fontSize: 11,
        fontWeight: '700',
        color: '#FFFFFF',
    },
    jobSubtitle: {
        fontSize: 12,
        color: '#888888',
        marginTop: 2,
        marginBottom: 12,
    },
    aiBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#1C1C1E',
        borderRadius: 8,
        paddingVertical: 10,
        paddingHorizontal: 12,
    },
    aiIcon: {
        width: 14,
        height: 14,
        resizeMode: 'contain',
        marginRight: 8,
    },
    aiBannerText: {
        flex: 1,
        flexShrink: 1,
        fontSize: 12,
        color: '#FFFFFF',
    },
    divider: {
        height: 1,
        backgroundColor: '#EDEDED',
        marginVertical: 14,
    },
    stepRow: {
        flexDirection: 'row',
        marginBottom: 10,
    },
    stepSegmentBase: {
        flex: 1,
        height: 6,
        borderRadius: 3,
        marginRight: 6,
    },
    stepSegmentLast: {
        marginRight: 0,
    },
    stepSegmentDone: {
        backgroundColor: '#2FAE60',
    },
    stepSegmentCurrent: {
        backgroundColor: '#0255AF',
    },
    stepSegmentUpcoming: {
        backgroundColor: '#E0E0E0',
    },
    currentStepLabel: {
        fontSize: 13,
        fontWeight: '700',
        color: '#222222',
        marginBottom: 4,
    },
    progressPaymentText: {
        fontSize: 12,
        color: '#888888',
        marginBottom: 16,
    },
    actionRow: {
        flexDirection: 'row',
    },
    actionButton: {
        flex: 1,
        borderWidth: 1,
        borderColor: '#CCCCCC',
        borderRadius: 20,
        paddingVertical: 10,
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
    },
    actionButtonSpacing: {
        marginRight: 10,
    },
    actionButtonText: {
        fontSize: 12,
        fontWeight: '600',
        color: '#333333',
    },
    emptyStateText: {
        fontSize: 13,
        color: '#999999',
        textAlign: 'center',
        marginTop: 20,
    },
    loader: {
        marginTop: 30,
    },
    errorBanner: {
        borderWidth: 1,
        borderColor: '#E0E0E0',
        borderRadius: 12,
        backgroundColor: '#F9F9F9',
        padding: 14,
        marginBottom: 16,
    },
    errorBannerText: {
        fontSize: 13,
        color: '#555555',
    },
});

export default Jobs;