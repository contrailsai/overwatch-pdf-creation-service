function makeProject() {
  return {
    project_name: 'Overwatch Test Project',
    project_details: {
      labels: [
        { name: 'is_hate_speech', severity: 'high' },
        { name: 'is_fake_news', severity: 'medium' },
      ],
      legal_codes: [
        { name: 'IT-66A', description: 'Sample IT Act description' },
      ],
    },
  };
}

function makeProfile() {
  return {
    _id: 'profile-1',
    username: 'fixture_user',
    display_name: 'Fixture User',
    platform: 'instagram',
    profile_url: 'https://example.com/fixture_user',
    is_verified: true,
    metadata: {
      biography: 'Fixture profile biography',
      follower_count: 1234,
      following_count: 111,
      media_count: 55,
      account_creation_date: '2024-01-11T00:00:00.000Z',
      profile_pic: null,
      is_business: true,
      location: 'Mumbai',
    },
  };
}

function makeNormalizedPost(overrides = {}) {
  return {
    _id: 'post-1',
    created_at: '2025-01-01T10:00:00.000Z',
    posted_date: '2025-01-01T09:30:00.000Z',
    updated_at: '2025-01-01T11:00:00.000Z',
    platform: 'instagram',
    client_status: 'To Be Reviewed',
    caption: 'Fixture caption #fixture',
    signedImageUrl: null,
    original_url: 'https://example.com/post/1',
    post_id: 'P001',
    user: {
      username: 'fixture_user',
      full_name: 'Fixture User',
      follower_count: 1234,
    },
    review_details: {
      threat_score: 80,
      flags: { is_hate_speech: true },
      reasoning: 'Description: Sample reasoning line',
      legal_codes: [{ code: 'IT-66A', reasoning: 'Sample legal reason' }],
      reviewed_at: '2025-01-01T11:00:00.000Z',
      threat_types: ['is_hate_speech'],
    },
    analysis_results: {
      risk_score: 80,
      categorization_reason: 'Fallback categorization',
    },
    update_history: [
      {
        updated_by: 'ops@example.com',
        updated_at: '2025-01-01T11:30:00.000Z',
        changes_summary: 'Reviewed by analyst',
      },
    ],
    client_notes: [
      {
        email: 'ops@example.com',
        created_at: '2025-01-01T11:35:00.000Z',
        text: 'Escalated for review.',
      },
    ],
    stats: {
      like_count: 100,
      comment_count: 10,
      share_count: 5,
      view_count: 1000,
    },
    ...overrides,
  };
}

module.exports = {
  makeProject,
  makeProfile,
  makeNormalizedPost,
};
