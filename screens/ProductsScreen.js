import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TextInput, 
  TouchableOpacity, 
  FlatList, 
  Image, 
  ActivityIndicator, 
  Alert,
  Modal,
  ScrollView,
  Switch,
  KeyboardAvoidingView,
  Platform,
  Dimensions
} from 'react-native';
import { supabase } from '../supabaseClient';
import { Ionicons, MaterialIcons, FontAwesome } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { decode } from 'base64-arraybuffer';

// Ekran boyutlarını alıyoruz
const { width, height } = Dimensions.get('window');

const ProductsScreen = ({ branchId }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [currentProduct, setCurrentProduct] = useState(null);
  
  // Sayfalama state'leri
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [totalCount, setTotalCount] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  
  // FlatList referansı
  const flatListRef = React.useRef();
  
  // Form state
  const [name, setName] = useState('');
  const [price, setPrice] = useState('');
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState(null);
  const [isActive, setIsActive] = useState(true);
  const [uploadedImage, setUploadedImage] = useState(null);
  const [imageUrl, setImageUrl] = useState(null);
  
  // Error messages
  const [errors, setErrors] = useState({});

  // Ürünleri ve kategorileri getir
  useEffect(() => {
    fetchCategories();
    fetchProducts();
  }, []);

  // Şube ID'si değiştiğinde ürünleri yeniden getir
  useEffect(() => {
    if (branchId) {
      fetchProducts();
    }
  }, [branchId]);

  // Sayfa değiştiğinde veya pageSize değiştiğinde ürünleri yeniden getir
  useEffect(() => {
    fetchProducts();
  }, [currentPage, pageSize, selectedCategory]);

  // Kategorileri getir
  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('name');
        
      if (error) throw error;
      
      if (data) {
        setCategories(data);
      }
    } catch (error) {
      console.error('Kategoriler alınırken hata:', error);
      Alert.alert('Hata', 'Kategoriler yüklenirken bir sorun oluştu.');
    }
  };

  // Ürünleri getir
  const fetchProducts = async () => {
    setLoading(true);
    try {
      // Önce toplam ürün sayısını öğren
      const countQuery = supabase
        .from('products')
        .select('id', { count: 'exact' });
      
      // Kategori filtresi varsa uygula
      if (selectedCategory) {
        countQuery.eq('category_id', selectedCategory);
      }
      
      // Toplam ürün sayısını al
      const { count, error: countError } = await countQuery;
      
      if (countError) throw countError;
      
      setTotalCount(count || 0);
      setTotalPages(Math.max(Math.ceil((count || 0) / pageSize), 1));
      
      // Sayfalama için başlangıç ve bitiş indeksleri
      const from = (currentPage - 1) * pageSize;
      const to = from + pageSize - 1;
      
      console.log(`Sayfalama: ${from} - ${to}, Toplam: ${count}, Sayfa: ${currentPage}/${Math.ceil((count || 0) / pageSize)}`);
      
      // Ürünleri getir
      let query = supabase
        .from('products')
        .select(`
          *,
          categories (
            id,
            name
          )
        `)
        .order('name')
        .range(from, to);
      
      // Kategori filtresi varsa uygula
      if (selectedCategory) {
        query = query.eq('category_id', selectedCategory);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      if (data) {
        setProducts(data);
        console.log(`${data.length} ürün yüklendi.`);
      }
      
      setLoading(false);
    } catch (error) {
      console.error('Ürünler alınırken hata:', error);
      Alert.alert('Hata', 'Ürünler yüklenirken bir sorun oluştu.');
      setLoading(false);
    }
  };

  // Filtreleme fonksiyonu
  const filteredProducts = products.filter(product => {
    const matchesSearch = product.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = selectedCategory ? product.category_id === selectedCategory : true;
    return matchesSearch && matchesCategory;
  });

  // Form alanlarını temizle
  const resetForm = () => {
    setName('');
    setPrice('');
    setDescription('');
    setCategoryId(null);
    setIsActive(true);
    setUploadedImage(null);
    setImageUrl(null);
    setErrors({});
  };

  // Düzenleme modunu başlat
  const startEdit = (product) => {
    setIsEditing(true);
    setCurrentProduct(product);
    setName(product.name);
    setPrice(product.price ? product.price.toString() : '');
    setDescription(product.description || '');
    setCategoryId(product.category_id);
    setIsActive(product.is_active !== false); // null veya undefined ise true kabul et
    setImageUrl(product.image_url);
    setModalVisible(true);
  };

  // Ürün formunu göster
  const showAddProductForm = () => {
    resetForm();
    setIsEditing(false);
    setCurrentProduct(null);
    setModalVisible(true);
  };

  // Form validasyonu
  const validateForm = () => {
    const newErrors = {};
    
    if (!name.trim()) newErrors.name = 'Ürün adı gereklidir';
    if (!price.trim()) newErrors.price = 'Fiyat gereklidir';
    else if (isNaN(parseFloat(price))) newErrors.price = 'Geçerli bir fiyat giriniz';
    if (!categoryId) newErrors.category = 'Kategori seçilmelidir';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Resim seçme
  const pickImage = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    
    if (status !== 'granted') {
      Alert.alert('İzin Gerekli', 'Resim seçmek için galeri izni gereklidir.');
      return;
    }
    
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
      base64: true,
    });
    
    if (!result.canceled && result.assets && result.assets[0]) {
      const asset = result.assets[0];
      setUploadedImage(asset);
    }
  };

  // Resmi yükle ve URL al
  const uploadImageAndGetUrl = async () => {
    if (!uploadedImage || !uploadedImage.base64) return null;
    
    try {
      const fileName = `product_${Date.now()}.jpg`;
      const filePath = `products/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, decode(uploadedImage.base64), {
          contentType: 'image/jpeg',
          upsert: true
        });
        
      if (uploadError) throw uploadError;
      
      // Public URL oluştur
      const { data } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
        
      return data.publicUrl;
    } catch (error) {
      console.error('Resim yüklenirken hata:', error);
      Alert.alert('Resim Yükleme Hatası', 'Resim yüklenirken bir sorun oluştu.');
      return null;
    }
  };

  // Ürün ekle veya güncelle
  const handleSaveProduct = async () => {
    if (!validateForm()) return;
    
    setLoading(true);
    
    try {
      // Eğer yeni resim yüklendiyse, storage'a yükle
      let finalImageUrl = imageUrl;
      if (uploadedImage) {
        finalImageUrl = await uploadImageAndGetUrl();
      }
      
      const productData = {
        name,
        price: parseFloat(price),
        description,
        category_id: categoryId,
        is_active: isActive,
        image_url: finalImageUrl,
        updated_at: new Date()
      };
      
      let result;
      
      if (isEditing && currentProduct) {
        // Ürün güncelleme
        result = await supabase
          .from('products')
          .update(productData)
          .eq('id', currentProduct.id);
      } else {
        // Yeni ürün ekleme
        productData.created_at = new Date();
        result = await supabase
          .from('products')
          .insert(productData);
      }
      
      if (result.error) throw result.error;
      
      // Başarılı ise formu kapat ve ürünleri yenile
      setModalVisible(false);
      resetForm();
      fetchProducts();
      
      Alert.alert(
        'Başarılı', 
        isEditing ? 'Ürün başarıyla güncellendi.' : 'Yeni ürün başarıyla eklendi.'
      );
    } catch (error) {
      console.error('Ürün kaydedilirken hata:', error);
      Alert.alert('Hata', 'Ürün kaydedilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Ürün silme
  const handleDeleteProduct = (product) => {
    Alert.alert(
      'Ürünü Sil',
      `"${product.name}" ürününü silmek istediğinize emin misiniz?`,
      [
        {
          text: 'İptal',
          style: 'cancel'
        },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            try {
              const { error } = await supabase
                .from('products')
                .delete()
                .eq('id', product.id);
                
              if (error) throw error;
              
              // Ürünü listeden kaldır
              setProducts(products.filter(p => p.id !== product.id));
              Alert.alert('Başarılı', 'Ürün başarıyla silindi.');
            } catch (error) {
              console.error('Ürün silinirken hata:', error);
              Alert.alert('Hata', 'Ürün silinirken bir sorun oluştu.');
            } finally {
              setLoading(false);
            }
          }
        }
      ]
    );
  };

  // Ürün durumunu değiştir (aktif/pasif)
  const toggleProductStatus = async (product) => {
    setLoading(true);
    try {
      const newStatus = !product.is_active;
      
      const { error } = await supabase
        .from('products')
        .update({ is_active: newStatus, updated_at: new Date() })
        .eq('id', product.id);
        
      if (error) throw error;
      
      // Ürün listesini güncelle
      setProducts(
        products.map(p => 
          p.id === product.id ? { ...p, is_active: newStatus } : p
        )
      );
      
      Alert.alert(
        'Durum Değiştirildi', 
        `Ürün durumu ${newStatus ? 'aktif' : 'pasif'} olarak ayarlandı.`
      );
    } catch (error) {
      console.error('Ürün durumu değiştirilirken hata:', error);
      Alert.alert('Hata', 'Ürün durumu değiştirilirken bir sorun oluştu.');
    } finally {
      setLoading(false);
    }
  };

  // Kategori adını ID'ye göre getir
  const getCategoryNameById = (categoryId) => {
    const category = categories.find(c => c.id === categoryId);
    return category ? category.name : 'Kategori Yok';
  };

  // Render ürün elementi
  const renderProductItem = ({ item }) => (
    <View style={styles.productItem}>
      <View style={styles.productImageContainer}>
        <Image 
          source={{ uri: item.image_url || 'https://via.placeholder.com/100' }}
          style={styles.productImage}
        />
      </View>
      
      <View style={styles.productInfo}>
        <Text style={styles.productName}>{item.name}</Text>
        <Text style={styles.productCategory}>{item.categories?.name || getCategoryNameById(item.category_id)}</Text>
        <Text style={styles.productPrice}>₺{parseFloat(item.price).toLocaleString('tr-TR')}</Text>
        {item.description && <Text style={styles.productDescription} numberOfLines={2}>{item.description}</Text>}
      </View>
      
      <View style={styles.productActions}>
        <TouchableOpacity 
          style={[styles.statusButton, item.is_active ? styles.activeStatus : styles.inactiveStatus]}
          onPress={() => toggleProductStatus(item)}
        >
          <Text style={styles.statusText}>{item.is_active ? 'Aktif' : 'Pasif'}</Text>
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => startEdit(item)}>
          <MaterialIcons name="edit" size={22} color="#2196F3" />
        </TouchableOpacity>
        
        <TouchableOpacity style={styles.actionButton} onPress={() => handleDeleteProduct(item)}>
          <MaterialIcons name="delete" size={22} color="#F44336" />
        </TouchableOpacity>
      </View>
    </View>
  );

  // Sayfa değiştirme fonksiyonları
  const goToPage = (page) => {
    if (page >= 1 && page <= totalPages) {
      setCurrentPage(page);
      // Liste başına scroll et
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  const goToPreviousPage = () => {
    if (currentPage > 1) {
      setCurrentPage(currentPage - 1);
      // Liste başına scroll et
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  const goToNextPage = () => {
    if (currentPage < totalPages) {
      setCurrentPage(currentPage + 1);
      // Liste başına scroll et
      if (flatListRef.current) {
        flatListRef.current.scrollToOffset({ offset: 0, animated: true });
      }
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>Ürün Yönetimi</Text>
        
        <TouchableOpacity style={styles.addButton} onPress={showAddProductForm}>
          <Text style={styles.addButtonText}>Yeni Ürün Ekle</Text>
          <Ionicons name="add-circle" size={24} color="white" />
        </TouchableOpacity>
      </View>

      <View style={styles.filterContainer}>
        <View style={styles.searchBar}>
          <Ionicons name="search" size={20} color="#666" />
          <TextInput
            style={styles.searchInput}
            placeholder="Ürün ara..."
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery ? (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#666" />
            </TouchableOpacity>
          ) : null}
        </View>
        
        <View style={styles.categoryFilters}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false}>
            <TouchableOpacity
              style={[
                styles.categoryChip,
                selectedCategory === null && styles.selectedCategory
              ]}
              onPress={() => setSelectedCategory(null)}
            >
              <Text style={[
                styles.categoryChipText,
                selectedCategory === null && styles.selectedCategoryText
              ]}>Tümü</Text>
            </TouchableOpacity>
            
            {categories.map(category => (
              <TouchableOpacity
                key={category.id}
                style={[
                  styles.categoryChip,
                  selectedCategory === category.id && styles.selectedCategory
                ]}
                onPress={() => setSelectedCategory(category.id)}
              >
                <Text style={[
                  styles.categoryChipText,
                  selectedCategory === category.id && styles.selectedCategoryText
                ]}>{category.name}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      </View>

      {loading && products.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#1e3a8a" />
          <Text style={styles.loadingText}>Ürünler yükleniyor...</Text>
        </View>
      ) : filteredProducts.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Ionicons name="basket" size={64} color="#ccc" />
          <Text style={styles.emptyText}>Ürün bulunamadı</Text>
          <Text style={styles.emptySubtext}>
            {searchQuery 
              ? 'Arama kriterlerinize uygun ürün bulunamadı.' 
              : 'Henüz ürün eklenmemiş. "Yeni Ürün Ekle" butonuna tıklayarak ürün ekleyin.'}
          </Text>
        </View>
      ) : (
        <FlatList
          ref={flatListRef}
          data={filteredProducts}
          renderItem={renderProductItem}
          keyExtractor={item => item.id.toString()}
          contentContainerStyle={styles.productsList}
          showsVerticalScrollIndicator={false}
        />
      )}

      {/* Sayfalama kontrolleri - sabit konumlu */}
      {!loading && products.length > 0 && (
        <View style={styles.fixedPagination}>
          <View style={styles.paginationInner}>
            <Text style={styles.paginationText}>
              Toplam {totalCount} ürün - Sayfa {currentPage} / {totalPages}
            </Text>
            
            <View style={styles.paginationArrows}>
              <TouchableOpacity 
                style={[styles.paginationArrow, currentPage === 1 && styles.paginationArrowDisabled]}
                onPress={goToPreviousPage}
                disabled={currentPage === 1}
              >
                <Ionicons name="chevron-back" size={24} color={currentPage === 1 ? "#ccc" : "#fff"} />
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={[styles.paginationArrow, currentPage === totalPages && styles.paginationArrowDisabled]}
                onPress={goToNextPage}
                disabled={currentPage === totalPages}
              >
                <Ionicons name="chevron-forward" size={24} color={currentPage === totalPages ? "#ccc" : "#fff"} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      )}

      {/* Ürün Ekleme/Düzenleme Modal */}
      <Modal
        animationType="slide"
        transparent={true}
        visible={modalVisible}
        onRequestClose={() => setModalVisible(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalContainer}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {isEditing ? 'Ürünü Düzenle' : 'Yeni Ürün Ekle'}
              </Text>
              <TouchableOpacity onPress={() => setModalVisible(false)}>
                <Ionicons name="close" size={24} color="#333" />
              </TouchableOpacity>
            </View>
            
            <ScrollView style={styles.modalBody}>
              {/* Resim Seçimi */}
              <View style={styles.imagePickerContainer}>
                <TouchableOpacity 
                  style={styles.imagePicker}
                  onPress={pickImage}
                >
                  {uploadedImage ? (
                    <Image 
                      source={{ uri: uploadedImage.uri }} 
                      style={styles.previewImage} 
                    />
                  ) : imageUrl ? (
                    <Image 
                      source={{ uri: imageUrl }} 
                      style={styles.previewImage} 
                    />
                  ) : (
                    <>
                      <Ionicons name="image" size={40} color="#666" />
                      <Text style={styles.imagePickerText}>Resim Seç</Text>
                    </>
                  )}
                </TouchableOpacity>
              </View>
            
              {/* Ürün Adı */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Ürün Adı *</Text>
                <TextInput
                  style={[styles.input, errors.name && styles.inputError]}
                  placeholder="Ürün adını girin"
                  value={name}
                  onChangeText={setName}
                />
                {errors.name && <Text style={styles.errorText}>{errors.name}</Text>}
              </View>
              
              {/* Kategori Seçimi */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Kategori *</Text>
                <View style={[styles.pickerContainer, errors.category && styles.inputError]}>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    {categories.map(category => (
                      <TouchableOpacity
                        key={category.id}
                        style={[
                          styles.categoryChip,
                          categoryId === category.id && styles.selectedCategory
                        ]}
                        onPress={() => setCategoryId(category.id)}
                      >
                        <Text style={[
                          styles.categoryChipText,
                          categoryId === category.id && styles.selectedCategoryText
                        ]}>{category.name}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
                {errors.category && <Text style={styles.errorText}>{errors.category}</Text>}
              </View>
              
              {/* Fiyat */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Fiyat (₺) *</Text>
                <TextInput
                  style={[styles.input, errors.price && styles.inputError]}
                  placeholder="0.00"
                  value={price}
                  onChangeText={setPrice}
                  keyboardType="numeric"
                />
                {errors.price && <Text style={styles.errorText}>{errors.price}</Text>}
              </View>
              
              {/* Açıklama */}
              <View style={styles.formGroup}>
                <Text style={styles.label}>Açıklama</Text>
                <TextInput
                  style={[styles.input, styles.textArea]}
                  placeholder="Ürün açıklaması girin"
                  value={description}
                  onChangeText={setDescription}
                  multiline
                  numberOfLines={4}
                />
              </View>
              
              {/* Durum */}
              <View style={styles.formGroup}>
                <View style={styles.switchContainer}>
                  <Text style={styles.label}>Aktif</Text>
                  <Switch
                    value={isActive}
                    onValueChange={setIsActive}
                    trackColor={{ false: '#ccc', true: '#81b0ff' }}
                    thumbColor={isActive ? '#1e3a8a' : '#f4f3f4'}
                  />
                </View>
                <Text style={styles.helperText}>
                  {isActive ? 'Ürün satışa açık olacak' : 'Ürün satışa kapalı olacak'}
                </Text>
              </View>
            </ScrollView>
            
            <View style={styles.modalFooter}>
              <TouchableOpacity 
                style={styles.cancelButton} 
                onPress={() => setModalVisible(false)}
              >
                <Text style={styles.cancelButtonText}>İptal</Text>
              </TouchableOpacity>
              
              <TouchableOpacity 
                style={styles.saveButton} 
                onPress={handleSaveProduct}
                disabled={loading}
              >
                {loading ? (
                  <ActivityIndicator size="small" color="white" />
                ) : (
                  <Text style={styles.saveButtonText}>
                    {isEditing ? 'Güncelle' : 'Kaydet'}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333',
  },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 5,
  },
  addButtonText: {
    color: 'white',
    marginRight: 5,
  },
  filterContainer: {
    padding: 15,
    backgroundColor: 'white',
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f0f0f0',
    borderRadius: 5,
    paddingHorizontal: 10,
    marginBottom: 10,
  },
  searchInput: {
    flex: 1,
    paddingVertical: 8,
    paddingHorizontal: 5,
  },
  categoryFilters: {
    marginTop: 10,
  },
  categoryChip: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: '#eee',
    marginRight: 10,
    borderWidth: 1,
    borderColor: '#ddd',
  },
  selectedCategory: {
    backgroundColor: '#1e3a8a',
    borderColor: '#1e3a8a',
  },
  categoryChipText: {
    color: '#333',
  },
  selectedCategoryText: {
    color: 'white',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    color: '#666',
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#666',
    marginTop: 10,
  },
  emptySubtext: {
    textAlign: 'center',
    color: '#999',
    marginTop: 5,
  },
  productsList: {
    padding: 10,
    paddingBottom: 80, // Sabit sayfalama kontrollerinin altında içerik kalmaması için
  },
  productItem: {
    flexDirection: 'row',
    backgroundColor: 'white',
    borderRadius: 10,
    padding: 15,
    marginBottom: 15,
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
  },
  productImageContainer: {
    marginRight: 15,
  },
  productImage: {
    width: 80,
    height: 80,
    borderRadius: 5,
    backgroundColor: '#f0f0f0',
  },
  productInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  productName: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333',
  },
  productCategory: {
    color: '#666',
    marginBottom: 5,
  },
  productPrice: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#1e3a8a',
    marginBottom: 5,
  },
  productDescription: {
    color: '#777',
    fontSize: 13,
  },
  productActions: {
    justifyContent: 'center',
    alignItems: 'flex-end',
  },
  actionButton: {
    padding: 8,
  },
  statusButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    marginBottom: 10,
  },
  activeStatus: {
    backgroundColor: '#e6f7ee',
  },
  inactiveStatus: {
    backgroundColor: '#ffebee',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
  },
  
  // Modal Styles
  modalContainer: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  modalContent: {
    backgroundColor: 'white',
    borderRadius: 10,
    marginHorizontal: 20,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: '#eee',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
  },
  modalBody: {
    padding: 15,
  },
  modalFooter: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 15,
    borderTopWidth: 1,
    borderTopColor: '#eee',
  },
  imagePickerContainer: {
    alignItems: 'center',
    marginBottom: 15,
  },
  imagePicker: {
    width: 120,
    height: 120,
    borderRadius: 10,
    backgroundColor: '#f0f0f0',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#ddd',
    borderStyle: 'dashed',
  },
  previewImage: {
    width: 120,
    height: 120,
    borderRadius: 10,
  },
  imagePickerText: {
    marginTop: 5,
    color: '#666',
  },
  formGroup: {
    marginBottom: 15,
  },
  label: {
    fontSize: 14,
    fontWeight: 'bold',
    marginBottom: 5,
    color: '#333',
  },
  input: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  inputError: {
    borderColor: '#f44336',
  },
  errorText: {
    color: '#f44336',
    fontSize: 12,
    marginTop: 5,
  },
  textArea: {
    height: 100,
    textAlignVertical: 'top',
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: '#ddd',
    borderRadius: 5,
    paddingHorizontal: 10,
    paddingVertical: 8,
    backgroundColor: '#f9f9f9',
  },
  switchContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#666',
    marginTop: 5,
  },
  saveButton: {
    backgroundColor: '#1e3a8a',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
    marginLeft: 10,
  },
  saveButtonText: {
    color: 'white',
    fontWeight: 'bold',
  },
  cancelButton: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 5,
  },
  cancelButtonText: {
    color: '#666',
  },
  fixedPagination: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    backgroundColor: '#fff',
    borderTopWidth: 1,
    borderTopColor: '#ddd',
    borderBottomWidth: 1,
    borderBottomColor: '#ddd',
    padding: 15,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 5,
    zIndex: 1000,
  },
  paginationInner: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  paginationText: {
    fontSize: 14,
    color: '#333',
    fontWeight: '500',
  },
  paginationArrows: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paginationArrow: {
    padding: 10,
    borderRadius: 8,
    backgroundColor: '#1e3a8a',
    marginLeft: 8,
    minWidth: 45,
    height: 45,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paginationArrowDisabled: {
    backgroundColor: '#e0e0e0',
  },
});

export default ProductsScreen; 