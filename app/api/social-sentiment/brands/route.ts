import { NextResponse } from 'next/server';
import { createSupabaseServerClient } from '@/src/ApifyPipeline/Infrastructure/Config/supabase';
import { fetchDistinctEnabledProducts } from '@/src/ApifyPipeline/DataAccess/Repositories/KeywordsRepository';

export async function GET() {
  try {
    const supabase = await createSupabaseServerClient();

    const products = await fetchDistinctEnabledProducts(supabase);

    return NextResponse.json({
      products: products.sort(),
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error('Error fetching brands:', error);
    return NextResponse.json(
      { error: 'Failed to fetch brands' },
      { status: 500 },
    );
  }
}
