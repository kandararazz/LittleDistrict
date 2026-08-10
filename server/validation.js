// Zod-style validation module for Dubai Community Kids backend

const PUBLIC_LOCATION_KEYWORDS = [
    'park', 'playground', 'clubhouse', 'recreation', 'rec center',
    'pool', 'sports court', 'court', 'beach', 'garden', 'walkway',
    'plaza', 'central park', 'community center', 'field', 'pitch', 'skatepark'
];

export function validateMeetup(data) {
    const errors = [];

    if (!data.title || typeof data.title !== 'string' || data.title.trim().length < 3) {
        errors.push("Title is required and must be at least 3 characters long.");
    }

    if (!data.district || typeof data.district !== 'string' || data.district.trim().length === 0) {
        errors.push("District / Community Area is required.");
    }

    if (!data.public_location || typeof data.public_location !== 'string' || data.public_location.trim().length < 3) {
        errors.push("Public location is required.");
    } else {
        const lowerLoc = data.public_location.toLowerCase();
        const isPublicSpot = PUBLIC_LOCATION_KEYWORDS.some(kw => lowerLoc.includes(kw));
        if (!isPublicSpot) {
            errors.push(
                `Public spot restriction failed: "${data.public_location}" must be a recognized public space (e.g., Park, Playground, Clubhouse, Recreation Center, Pool, Sports Court, Beach, Community Garden). Private homes are not allowed.`
            );
        }
    }

    if (!data.date_time || typeof data.date_time !== 'string') {
        errors.push("Date and time are required.");
    }

    if (!data.interest_tag || typeof data.interest_tag !== 'string') {
        errors.push("Interest tag is required.");
    }

    const minAge = Number(data.min_age ?? 0);
    const maxAge = Number(data.max_age ?? 18);
    if (isNaN(minAge) || minAge < 0) errors.push("Minimum age must be 0 or greater.");
    if (isNaN(maxAge) || maxAge > 18 || maxAge < minAge) errors.push("Maximum age must be valid and >= minimum age.");

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            min_age: minAge,
            max_age: maxAge,
            max_attendees: Number(data.max_attendees || 10)
        } : null
    };
}

export function validatePlace(data) {
    const errors = [];

    if (!data.name || typeof data.name !== 'string' || data.name.trim().length < 2) {
        errors.push("Place name is required and must be at least 2 characters.");
    }

    if (!data.district || typeof data.district !== 'string' || data.district.trim().length === 0) {
        errors.push("District / Community area is required.");
    }

    const validTypes = ['Park', 'Playground', 'Clubhouse', 'Recreation Center', 'Pool', 'Sports Court', 'Beach', 'Plaza'];
    if (!data.public_spot_type || !validTypes.includes(data.public_spot_type)) {
        errors.push(`Public spot type must be one of: ${validTypes.join(', ')}.`);
    }

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            name: data.name.trim(),
            district: data.district.trim(),
            public_spot_type: data.public_spot_type,
            description: data.description ? data.description.trim() : ''
        } : null
    };
}
