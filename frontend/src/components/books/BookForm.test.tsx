import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

import BookForm from './BookForm';

describe('BookForm', () => {
  it('clears each error once that field is fixed', async () => {
    const onSubmit = vi.fn();
    render(<BookForm onSubmit={onSubmit} submitLabel="List book" />);

    await userEvent.click(screen.getByRole('button', { name: 'List book' }));
    expect(screen.getByText('Enter the title.')).toBeInTheDocument();
    expect(screen.getByText('Add at least one photo of your copy.')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Title'), 'Dune');
    expect(screen.queryByText('Enter the title.')).not.toBeInTheDocument();
    expect(screen.getByText('Enter the author.')).toBeInTheDocument();

    const photo = new File([new Uint8Array([0x89, 0x50, 0x4e, 0x47])], 'cover.png', { type: 'image/png' });
    await userEvent.upload(screen.getByLabelText(/Photos/), photo);
    expect(screen.queryByText('Add at least one photo of your copy.')).not.toBeInTheDocument();
    expect(onSubmit).not.toHaveBeenCalled();
  });
});
