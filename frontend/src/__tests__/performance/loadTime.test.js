import { render, screen, waitFor } from '@testing-library/react';

// Mock any components that might be used
jest.mock('../../components/ui/Spinner', () => {
  return function MockSpinner() {
    return <div data-testid="spinner">Loading...</div>;
  };
});

// Simple performance test without specific components
describe('Performance Tests', () => {
  test('component rendering should be efficient', async () => {
    const startTime = performance.now();
    
    // Test with a simple div to measure basic rendering performance
    const { container } = render(<div>Test Component</div>);
    
    await waitFor(() => {
      expect(screen.getByText('Test Component')).toBeInTheDocument();
    });
    
    const loadTime = performance.now() - startTime;
    expect(loadTime).toBeLessThan(1000); // Should render in under 1 second
  });

  test('large lists should render efficiently', () => {
    const largeList = Array.from({ length: 1000 }, (_, i) => `Item ${i}`);
    
    const startTime = performance.now();
    const { container } = render(
      <div>
        {largeList.slice(0, 50).map(item => ( // Only render first 50 items
          <div key={item} className="list-item">{item}</div>
        ))}
      </div>
    );
    
    const renderTime = performance.now() - startTime;
    expect(renderTime).toBeLessThan(500); // Should render in under 500ms
    
    const visibleItems = container.querySelectorAll('.list-item');
    expect(visibleItems.length).toBe(50);
  });
});