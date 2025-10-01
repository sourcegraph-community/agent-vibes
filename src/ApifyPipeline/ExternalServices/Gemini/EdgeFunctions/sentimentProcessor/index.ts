/// <reference path="./deno.d.ts" />
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { sentimentProcessorEndpoint } from './web/ProcessSentimentsEndpoint.ts';

serve((request: Request) => sentimentProcessorEndpoint(request));
