# TranslateMe Test Website

This is a comprehensive test website designed to test the TranslateMe browser extension with real-world multilingual content.

## 🌐 Website Features

### **Sidebar Navigation**
- **Accueil** (French) - Home page
- **Produits** (French) - Products page  
- **À propos** (French) - About page
- **Contact** (French) - Contact page
- **Services** (French) - Services page
- **Actualités** (French) - News page
- **Galerie** (French) - Gallery page
- **Support** (French) - Support page

### **Multilingual Content Types**

#### **1. Static Content (Should be flagged as issues)**
- French navigation links on English site
- Arabic headers and text
- Mixed language buttons and labels

#### **2. Dynamic Content (Should be skipped)**
- User reviews in mixed languages
- User comments with multiple languages
- User-generated content that looks like interface text

#### **3. Forms Content (Should be flagged as issues)**
- French form labels on English site
- Arabic form placeholders
- Mixed language validation messages

## 🧪 Testing Scenarios

### **Expected Translation Issues:**

1. **Navigation Menu:**
   - "Accueil" → Should be "Home"
   - "Produits" → Should be "Products"
   - "À propos" → Should be "About"
   - "Contact" → Should be "Contact"
   - "Services" → Should be "Services"
   - "Actualités" → Should be "News"
   - "Galerie" → Should be "Gallery"
   - "Support" → Should be "Support"

2. **Headers and Titles:**
   - "مرحباً بكم في موقعنا" (Arabic) → Should be "Welcome to our website"
   - "خدماتنا" (Arabic) → Should be "Our Services"
   - "رؤيتنا" (Arabic) → Should be "Our Vision"

3. **Form Elements:**
   - "Nom complet:" (French) → Should be "Full Name:"
   - "البريد الإلكتروني:" (Arabic) → Should be "Email:"
   - "Entrez votre email" (French) → Should be "Enter your email"

4. **Buttons and CTAs:**
   - "En savoir plus" (French) → Should be "Learn More"
   - "Voir les produits" (French) → Should be "View Products"
   - "Acheter maintenant" (French) → Should be "Buy Now"
   - "شراء الآن" (Arabic) → Should be "Buy Now"

### **Expected Skipped Content:**

1. **User Reviews:**
   - Mixed French-English reviews
   - Mixed Arabic-English reviews
   - User comments with interface-like text

2. **Dynamic Content:**
   - User-generated descriptions
   - Personal testimonials
   - Social media style content

## 🚀 How to Test

### **1. Open the Website**
```bash
# Navigate to the test website directory
cd test-website

# Open index.html in your browser
open index.html
# or
# Double-click index.html
```

### **2. Install TranslateMe Extension**
- Load the extension in Chrome/Edge
- Make sure it's enabled and configured with GPT-4o

### **3. Test the Extension**
1. **Open the website** in your browser
2. **Click the TranslateMe extension icon**
3. **Set expected language to English**
4. **Click "Scan This Page"**
5. **Observe the results:**
   - Static content should be flagged as issues
   - Dynamic content should be skipped
   - Forms content should be flagged as issues

### **4. Test Different Pages**
- Navigate through different sections using the sidebar
- Test each page for translation issues
- Verify that user content is properly skipped

## 📊 Expected Results

### **Issues Found (Approximately 25-30 issues):**

#### **Static Content Issues:**
- Navigation menu items (8 issues)
- Page headers and titles (6 issues)
- Button text and CTAs (8 issues)
- Section headings (4 issues)

#### **Forms Content Issues:**
- Form labels (6 issues)
- Form placeholders (4 issues)
- Validation messages (2 issues)

#### **Skipped Content:**
- User reviews (3 items)
- User comments (2 items)
- Dynamic descriptions (5 items)

## 🎯 Testing Checklist

- [ ] Extension loads without errors
- [ ] Scan completes successfully
- [ ] French navigation items are flagged as issues
- [ ] Arabic headers are flagged as issues
- [ ] Mixed language user content is skipped
- [ ] Form labels are flagged as issues
- [ ] Issue count matches expected results
- [ ] Filtering works correctly (Static/Dynamic/All)
- [ ] Highlighting works on flagged issues
- [ ] Hover shows correct language detection

## 🔧 Troubleshooting

### **If Extension Doesn't Work:**
1. Check browser console for errors
2. Verify API key is configured
3. Check network connectivity
4. Ensure extension is enabled

### **If Results Are Unexpected:**
1. Check expected language setting
2. Verify content type classification
3. Check for mixed language detection
4. Review prompt configuration

## 📝 Notes

- This website is designed specifically for testing translation detection
- Content includes realistic scenarios found on multilingual websites
- Mixed language content tests the extension's ability to distinguish user content from interface elements
- The sidebar navigation provides easy access to different content types for comprehensive testing

## 🌍 Language Support

The test website includes:
- **English**: Base language (expected)
- **French**: Interface elements (should be flagged)
- **Arabic**: Headers and content (should be flagged)
- **Mixed Languages**: User content (should be skipped)

This provides comprehensive testing for the most common multilingual website scenarios.
