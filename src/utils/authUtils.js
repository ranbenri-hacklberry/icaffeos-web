export const getCurrentBusinessId = () => {
    const authKey = localStorage.getItem('manager_auth_key');
    if (authKey) {
        try {
            const decoded = JSON.parse(decodeURIComponent(atob(authKey)));
            return decoded.business_id;
        } catch (e) {
            console.error('Error getting business_id', e);
        }
    }
    return null;
};
