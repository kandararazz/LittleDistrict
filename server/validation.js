// Validation module for LittleDistrict Dubai

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
    }

    if (!data.date_time || typeof data.date_time !== 'string') {
        errors.push("Date and time are required.");
    }

    if (!data.interest_tag || typeof data.interest_tag !== 'string') {
        errors.push("Interest tag is required.");
    }

    const minAge = Number(data.min_age ?? 0);
    const maxAge = Number(data.max_age ?? 18);

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            title: data.title.trim(),
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
    }

    if (!data.district || typeof data.district !== 'string' || data.district.trim().length === 0) {
        errors.push("District / Community area is required.");
    }

    return {
        success: errors.length === 0,
        errors,
        data: errors.length === 0 ? {
            ...data,
            name: data.name.trim(),
            district: data.district.trim(),
            public_spot_type: data.public_spot_type || 'Park',
            description: data.description ? data.description.trim() : ''
        } : null
    };
}
