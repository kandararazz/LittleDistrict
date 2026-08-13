// Validation module for LittleDistrict Dubai with Public Location Guard & Smart Moderation

const PRIVATE_RESIDENCE_KEYWORDS = [
    'villa', 'apartment', 'flat', 'house', 'residence', 'apt', 'unit', 
    'street address', 'building #', 'flat #', 'villa #', 'home'
];

const BANNED_WORDS = [
    'abuse', 'badword', 'scam', 'spam', 'hate', 'illegal', 'nude', 'gambling'
];

// Check if a given location string is a private residence address
export function isPrivateResidence(locationText) {
    if (!locationText || typeof locationText !== 'string') return false;
    const lower = locationText.toLowerCase();
    return PRIVATE_RESIDENCE_KEYWORDS.some(kw => lower.includes(kw));
}

// Smart Content Moderation: Filter phone numbers, external URLs, and inappropriate words
export function moderateContent(text) {
    if (!text || typeof text !== 'string') return { cleanText: '', isFlagged: false, reason: '' };
    
    let cleanText = text;
    let isFlagged = false;
    let reasons = [];

    // 1. Phone number filter (e.g. +971501234567, 0501234567, 971 50 123 4567)
    const phoneRegex = /(?:\+?971|0)?\s?5[024568]\s?\d{3}\s?\d{4}|\b\d{7,12}\b/gi;
    if (phoneRegex.test(cleanText)) {
        isFlagged = true;
        reasons.push("Phone numbers are blocked for child privacy.");
        cleanText = cleanText.replace(phoneRegex, "[Phone Number Blocked]");
    }

    // 2. External URL filter
    const urlRegex = /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9.-]+\.(com|ae|org|net|io|co|me|app)[^\s]*)/gi;
    if (urlRegex.test(cleanText)) {
        isFlagged = true;
        reasons.push("External links are blocked in community chat.");
        cleanText = cleanText.replace(urlRegex, "[Link Blocked]");
    }

    // 3. Profanity / Banned words filter
    BANNED_WORDS.forEach(word => {
        const wordRegex = new RegExp(`\\b${word}\\b`, 'gi');
        if (wordRegex.test(cleanText)) {
            isFlagged = true;
            reasons.push("Inappropriate language detected.");
            cleanText = cleanText.replace(wordRegex, '***');
        }
    });

    return {
        cleanText,
        isFlagged,
        reason: reasons.join(' ')
    };
}

export function validateMeetup(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 2) {
        errors.push("Title is required and must be at least 2 characters long.");
    }

    if (!data.district || typeof data.district !== 'string' || data.district.trim().length === 0) {
        errors.push("District / Community Area is required.");
    }

    if (!data.public_location || typeof data.public_location !== 'string' || data.public_location.trim().length < 2) {
        errors.push("Public location is required.");
    } else if (isPrivateResidence(data.public_location)) {
        errors.push("Safety Guard: Meeting spots must be public places (community parks, clubhouses, sports courts). Private villa/apartment addresses are not allowed.");
    }

    if (!data.date_time || typeof data.date_time !== 'string') {
        errors.push("Date and time are required.");
    }

    if (!data.interest_tag || typeof data.interest_tag !== 'string') {
        errors.push("Interest tag is required.");
    }

    // Content moderation check on title
    if (data.title) {
        const modTitle = moderateContent(data.title);
        if (modTitle.isFlagged && modTitle.reason) {
            errors.push(`Title content issue: ${modTitle.reason}`);
        }
    }

    const minAge = Number(data.min_age ?? 0);
    const maxAge = Number(data.max_age ?? 18);

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            title: moderateContent(data.title).cleanText.trim(),
            district: data.district.trim(),
            public_location: data.public_location.trim(),
            date_time: data.date_time.trim(),
            interest_tag: data.interest_tag.trim(),
            min_age: isNaN(minAge) ? 0 : minAge,
            max_age: isNaN(maxAge) ? 18 : maxAge,
            max_attendees: Number(data.max_attendees || 10)
        } : null
    };
}

export function validatePlace(data) {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
        errors.push("Place name is required and must be at least 2 characters.");
    } else if (isPrivateResidence(data.name)) {
        errors.push("Safety Guard: Only public parks, playgrounds, or community spots can be added. Private residential addresses are restricted.");
    }

    if (!data.district || typeof data.district !== 'string' || data.district.trim().length === 0) {
        errors.push("District / Community area is required.");
    }

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            name: moderateContent(data.name).cleanText.trim(),
            district: data.district.trim(),
            public_spot_type: data.public_spot_type || 'Park',
            description: data.description ? moderateContent(data.description).cleanText.trim() : ''
        } : null
    };
}

