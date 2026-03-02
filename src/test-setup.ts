jest.mock('node-fetch', () => {
	return {
		default: jest.fn(),
	};
});
