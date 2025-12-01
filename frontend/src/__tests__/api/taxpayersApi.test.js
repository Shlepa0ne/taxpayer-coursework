// frontend/src/__tests__/api/taxpayersApi.test.js
import { 
  getMyAccruals, 
  createTaxReduceRequest, 
  getMyDeclarations 
} from '../../api/taxpayersApi';
import axiosInstance from '../../api/axiosInstance';

jest.mock('../../api/axiosInstance');

describe('Taxpayers API', () => {
  test('getMyAccruals should return accruals data', async () => {
    const mockAccruals = [{ id: 1, amount: 1000 }];
    axiosInstance.get.mockResolvedValue({ data: mockAccruals });

    const result = await getMyAccruals();

    expect(axiosInstance.get).toHaveBeenCalledWith('/my-accruals/');
    expect(result).toEqual(mockAccruals);
  });

  test('createTaxReduceRequest should send correct data', async () => {
    const requestData = {
      requested_reduce_amount: 5000,
      full_description: 'Test description',
      reduce_base: 1,
      reduce_type: 1,
      tax_types: [1, 2],
      periods: [{ start_date: '2024-01-01', end_date: '2024-12-31' }]
    };
    const mockResponse = { data: { request_id: 123 } };
    axiosInstance.post.mockResolvedValue(mockResponse);

    const result = await createTaxReduceRequest(requestData);

    expect(axiosInstance.post).toHaveBeenCalledWith('/tax-reduce-requests/', requestData);
    expect(result).toEqual(mockResponse.data);
  });
});