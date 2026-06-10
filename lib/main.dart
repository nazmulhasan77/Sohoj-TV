import 'package:flutter/material.dart';

void main() {
  runApp(const SohojTvApp());
}

class SohojTvApp extends StatelessWidget {
  const SohojTvApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      title: 'Sohoj TV',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: const Color(0xFF0B5CFF),
          brightness: Brightness.dark,
        ),
        scaffoldBackgroundColor: const Color(0xFF090B10),
        useMaterial3: true,
      ),
      home: const SohojHome(),
    );
  }
}

class SohojHome extends StatelessWidget {
  const SohojHome({super.key});

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: SafeArea(
        child: Center(
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 460),
            child: Padding(
              padding: const EdgeInsets.all(24),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: Image.asset(
                      'assets/sohoj tv logo.jpg',
                      width: 148,
                      height: 148,
                      fit: BoxFit.contain,
                    ),
                  ),
                  const SizedBox(height: 22),
                  Text(
                    'Sohoj TV',
                    style: Theme.of(context).textTheme.headlineMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    'Live channels by Butterfly Devs',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: const Color(0xFF96A3B7),
                        ),
                  ),
                  const SizedBox(height: 32),
                  DecoratedBox(
                    decoration: BoxDecoration(
                      color: const Color(0xFF05070D),
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFF263244)),
                    ),
                    child: Padding(
                      padding: const EdgeInsets.all(10),
                      child: Image.asset(
                        'assets/promotion.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
